from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db import get_db
from app.models.campus import Announcement, Resource
from app.models.user import User, UserRole
from app.routes.user_management import get_current_user_management_role

router = APIRouter(prefix="/campus", tags=["campus"])

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_role: Optional[str] = "all"
    department_id: Optional[int] = None

class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    file_path: str
    dept_id: int

@router.get("/announcements")
def list_announcements(
    role: Optional[str] = None, 
    department_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    query = db.query(Announcement)
    if role:
        query = query.filter((Announcement.target_role == "all") | (Announcement.target_role == role))
    if department_id:
        query = query.filter((Announcement.department_id == None) | (Announcement.department_id == department_id))
    
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
