from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.db import get_db
from app.models.user import User, UserRole, UserProfile, ClassRoom, FacultyMapping
from app.models.exam_portal import Department
from app.crypto import hash_secret

router = APIRouter(prefix="/user-management", tags=["user-management"])

# Pydantic Schemas
class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ClassRoomCreate(BaseModel):
    department_id: int
    name: str
    year: int

class FacultyMappingCreate(BaseModel):
    user_id: int
    department_id: int
    class_id: Optional[int] = None
    is_incharge: bool = False

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[int] = None
    class_id: Optional[int] = None
    year: Optional[int] = None
    data: Optional[dict] = None

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str # student or faculty
    identifier: str # Faculty ID or Student ID

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    identifier: Optional[str] = None

# Helper to verify permissions
def get_current_user_management_role(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/departments")
def create_department(payload: DepartmentCreate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only Super Admin can manage departments")
    
    code = payload.name.lower().replace(" ", "-")
    dept = Department(name=payload.name, code=code, description=payload.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/class-rooms")
def list_class_rooms(department_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ClassRoom)
    if department_id:
        query = query.filter(ClassRoom.department_id == department_id)
    return query.all()

@router.post("/class-rooms")
def create_class_room(payload: ClassRoomCreate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.super_admin, UserRole.admin]:
        raise HTTPException(status_code=403, detail="Insufficient permissions to create classes")
    
    classroom = ClassRoom(department_id=payload.department_id, name=payload.name, year=payload.year)
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom

@router.get("/students")
def list_students(
    user_id: int, 
    department_id: Optional[int] = None, 
    class_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    user = get_current_user_management_role(user_id, db)
    query = db.query(User).filter(User.role == UserRole.student)

    if user.role == UserRole.faculty:
        # Faculty can only see students in their assigned department/class
        mappings = db.query(FacultyMapping).filter(FacultyMapping.user_id == user.id).all()
        if not mappings:
            return [] # No mappings, no students
            
        from sqlalchemy import or_, and_
        mapping_filters = []
        for m in mappings:
            if m.class_id:
                # Specific class access
                mapping_filters.append(and_(UserProfile.department_id == m.department_id, UserProfile.class_id == m.class_id))
            else:
                # Department-wide access
                mapping_filters.append(UserProfile.department_id == m.department_id)
            
        query = query.join(UserProfile).filter(or_(*mapping_filters))
    elif user.role in [UserRole.admin, UserRole.super_admin]:
        if department_id:
            query = query.join(UserProfile).filter(UserProfile.department_id == department_id)
        if class_id:
            query = query.join(UserProfile).filter(UserProfile.class_id == class_id)
    else:
        raise HTTPException(status_code=403, detail="Students cannot access this list")

    students = query.all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "department": s.profile.department.name if s.profile and s.profile.department else None,
            "class": s.profile.classroom.name if s.profile and s.profile.classroom else None,
            "year": s.profile.year if s.profile else None,
            "data": s.profile.data if s.profile else {}
        } for s in students
    ]

@router.patch("/students/{target_id}")
def update_student(target_id: int, payload: StudentUpdate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    student = db.query(User).filter(User.id == target_id, User.role == UserRole.student).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    can_edit = False
    if user.role in [UserRole.super_admin, UserRole.admin]:
        can_edit = True
    elif user.role == UserRole.faculty:
        # Only class incharge can edit
        mapping = db.query(FacultyMapping).filter(
            FacultyMapping.user_id == user.id,
            FacultyMapping.class_id == student.profile.class_id,
            FacultyMapping.is_incharge == True
        ).first()
        if mapping:
            can_edit = True
            # Faculty cannot change department
            if payload.department_id and payload.department_id != student.profile.department_id:
                raise HTTPException(status_code=403, detail="Faculty cannot change student department")

    if not can_edit:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this student")

    if payload.name: student.name = payload.name
    if payload.email: student.email = payload.email
    
    if not student.profile:
        student.profile = UserProfile(user_id=student.id)
        db.add(student.profile)

    if payload.department_id: student.profile.department_id = payload.department_id
    if payload.class_id: student.profile.class_id = payload.class_id
    if payload.year: student.profile.year = payload.year
    if payload.data: student.profile.data = {**student.profile.data, **payload.data}

    db.commit()
    return {"status": "success"}

@router.get("/faculty")
def list_faculty(user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.admin, UserRole.super_admin]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    faculties = db.query(User).filter(User.role == UserRole.faculty).all()
    return [
        {
            "id": f.id,
            "name": f.name,
            "email": f.email,
            "identifier": f.profile.data.get("identifier") if f.profile and f.profile.data else None,
            "mappings": [
                {
                    "id": m.id,
                    "dept": m.department.name,
                    "class": m.classroom.name if m.classroom else "All",
                    "incharge": m.is_incharge
                } for m in db.query(FacultyMapping).filter(FacultyMapping.user_id == f.id).all()
            ]
        } for f in faculties
    ]

@router.post("/users")
def create_user(payload: UserCreate, user_id: int, db: Session = Depends(get_db)):
    admin = get_current_user_management_role(user_id, db)
    if admin.role not in [UserRole.admin, UserRole.super_admin]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    allowed_roles = ["student", "faculty"]
    if admin.role == UserRole.super_admin:
        allowed_roles.append("admin")

    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {allowed_roles}")

    # Check if user already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password=hash_secret(payload.password),
        role=UserRole[payload.role]
    )
    db.add(new_user)
    db.flush() # Get the new_user.id

    # Create profile
    profile = UserProfile(
        user_id=new_user.id,
        data={"identifier": payload.identifier}
    )
    db.add(profile)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "status": "created"}

@router.get("/admins")
def list_admins(user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only Super Admin can manage other admins")
    
    admins = db.query(User).filter(User.role == UserRole.admin).all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "email": a.email,
            "identifier": a.profile.data.get("identifier") if a.profile and a.profile.data else "N/A"
        } for a in admins
    ]

@router.patch("/users/{target_id}")
def update_user_v2(target_id: int, payload: UserUpdate, user_id: int, db: Session = Depends(get_db)):
    admin = get_current_user_management_role(user_id, db)
    if admin.role not in [UserRole.admin, UserRole.super_admin]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    target_user = db.query(User).filter(User.id == target_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name: target_user.name = payload.name
    if payload.email: target_user.email = payload.email
    if payload.password: target_user.password = hash_secret(payload.password)
    
    if payload.identifier:
        if not target_user.profile:
            target_user.profile = UserProfile(user_id=target_user.id, data={})
            db.add(target_user.profile)
        
        target_user.profile.data = {**target_user.profile.data, "identifier": payload.identifier}
    
    db.commit()
    return {"status": "updated"}

@router.post("/faculty-mappings")
def create_faculty_mapping(payload: FacultyMappingCreate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.admin, UserRole.super_admin]:
        raise HTTPException(status_code=403, detail="Only Admin/SuperAdmin can map faculty")
    
    mapping = FacultyMapping(
        user_id=payload.user_id,
        department_id=payload.department_id,
        class_id=payload.class_id,
        is_incharge=payload.is_incharge
    )
    db.add(mapping)
    db.commit()
    return {"status": "mapped"}

@router.delete("/faculty-mappings/{mapping_id}")
def delete_faculty_mapping(mapping_id: int, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.admin, UserRole.super_admin]:
        raise HTTPException(status_code=403, detail="Only Admin/SuperAdmin can delete mappings")
    
    mapping = db.query(FacultyMapping).filter(FacultyMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    db.delete(mapping)
    db.commit()
    return {"status": "deleted"}
