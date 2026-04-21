from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db import get_db
from app.models.campus import Announcement, Resource
from app.models.user import User, UserRole, FacultyMapping
from app.routes.user_management import get_current_user_management_role

router = APIRouter(prefix="/campus", tags=["campus"])

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_role: Optional[str] = "all" # Keep for compatibility
    target_roles: Optional[str] = None # "admin,faculty,student"
    target_depts: Optional[str] = None # "1,2,3"
    target_classes: Optional[str] = None # "10,11"
    target_users: Optional[str] = None # "5,6"
    department_id: Optional[int] = None

class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    file_path: str
    dept_id: int

@router.get("/announcements")
def list_announcements(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's context
    dept_id = user.profile.department_id if user.profile else None
    class_id = user.profile.class_id if user.profile else None
    
    # For faculty, check mappings
    fac_depts = []
    fac_classes = []
    if user.role == UserRole.faculty:
        mappings = db.query(FacultyMapping).filter(FacultyMapping.user_id == user.id).all()
        fac_depts = [m.department_id for m in mappings]
        fac_classes = [m.class_id for m in mappings if m.class_id]

    query = db.query(Announcement)
    
    # Filtering logic
    from sqlalchemy import or_
    
    # 1. Super Admin sees everything
    if user.role == UserRole.super_admin:
        return query.order_by(Announcement.created_at.desc()).all()
    
    filters = [
        # Legacy all or specific role
        (Announcement.target_role == "all"),
        (Announcement.target_role == user.role.value),
        # Target specific users
        Announcement.target_users.like(f"%{user.id}%"),
        # Target roles (comma separated)
        Announcement.target_roles.like(f"%{user.role.value}%")
    ]
    
    if dept_id:
        filters.append(Announcement.target_depts.like(f"%{dept_id}%"))
    if class_id:
        filters.append(Announcement.target_classes.like(f"%{class_id}%"))
        
    for fd in fac_depts:
        filters.append(Announcement.target_depts.like(f"%{fd}%"))
    for fc in fac_classes:
        filters.append(Announcement.target_classes.like(f"%{fc}%"))
        
    query = query.filter(or_(*filters))
    
    return query.order_by(Announcement.created_at.desc()).all()

@router.post("/announcements")
def create_announcement(payload: AnnouncementCreate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.admin, UserRole.super_admin, UserRole.faculty]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    announcement = Announcement(
        title=payload.title,
        content=payload.content,
        target_role=payload.target_role,
        target_roles=payload.target_roles,
        target_depts=payload.target_depts,
        target_classes=payload.target_classes,
        target_users=payload.target_users,
        department_id=payload.department_id,
        created_by=user_id
    )
    db.add(announcement)
    db.commit()
    return {"status": "success"}

@router.get("/resources")
def list_resources(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Resource)
    if dept_id:
        query = query.filter(Resource.dept_id == dept_id)
    return query.all()

@router.post("/resources")
def create_resource(payload: ResourceCreate, user_id: int, db: Session = Depends(get_db)):
    user = get_current_user_management_role(user_id, db)
    if user.role not in [UserRole.admin, UserRole.super_admin, UserRole.faculty]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    resource = Resource(
        title=payload.title,
        description=payload.description,
        file_path=payload.file_path,
        dept_id=payload.dept_id,
        uploaded_by=user_id
    )
    db.add(resource)
    db.commit()
    return {"status": "success"}
