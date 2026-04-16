from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import AppContentDocument, AppPreference, User, UserProfile

router = APIRouter(prefix="/app", tags=["app-persistence"])


class JsonDocumentPayload(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)


class ProfileResponse(BaseModel):
    user_id: int
    data: Dict[str, Any]
    updated_at: datetime | None = None


class PreferenceResponse(BaseModel):
    key: str
    data: Dict[str, Any]
    updated_at: datetime | None = None


class ContentDocumentResponse(BaseModel):
    key: str
    data: Dict[str, Any]
    updated_at: datetime | None = None


@router.get("/profile/{user_id}", response_model=ProfileResponse)
def get_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return ProfileResponse(user_id=user_id, data=profile.data if profile and profile.data else {}, updated_at=profile.updated_at if profile else None)


@router.put("/profile/{user_id}", response_model=ProfileResponse)
def save_profile(user_id: int, payload: JsonDocumentPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id, data=payload.data or {})
        db.add(profile)
    else:
        profile.data = payload.data or {}
    db.commit()
    db.refresh(profile)
    return ProfileResponse(user_id=user_id, data=profile.data or {}, updated_at=profile.updated_at)


@router.get("/preferences/{preference_key}", response_model=PreferenceResponse)
def get_preference(preference_key: str, db: Session = Depends(get_db)):
    preference = db.query(AppPreference).filter(AppPreference.preference_key == preference_key).first()
    if not preference:
        return PreferenceResponse(key=preference_key, data={}, updated_at=None)
    return PreferenceResponse(key=preference_key, data=preference.data or {}, updated_at=preference.updated_at)


@router.put("/preferences/{preference_key}", response_model=PreferenceResponse)
def save_preference(preference_key: str, payload: JsonDocumentPayload, db: Session = Depends(get_db)):
    preference = db.query(AppPreference).filter(AppPreference.preference_key == preference_key).first()
    if not preference:
        preference = AppPreference(preference_key=preference_key, data=payload.data or {})
        db.add(preference)
    else:
        preference.data = payload.data or {}
    db.commit()
    db.refresh(preference)
    return PreferenceResponse(key=preference_key, data=preference.data or {}, updated_at=preference.updated_at)


@router.get("/content/{document_key}", response_model=ContentDocumentResponse)
def get_content_document(document_key: str, db: Session = Depends(get_db)):
    document = db.query(AppContentDocument).filter(AppContentDocument.document_key == document_key).first()
    if not document:
        return ContentDocumentResponse(key=document_key, data={}, updated_at=None)
    return ContentDocumentResponse(key=document_key, data=document.data or {}, updated_at=document.updated_at)


@router.put("/content/{document_key}", response_model=ContentDocumentResponse)
def save_content_document(document_key: str, payload: JsonDocumentPayload, db: Session = Depends(get_db)):
    document = db.query(AppContentDocument).filter(AppContentDocument.document_key == document_key).first()
    if not document:
        document = AppContentDocument(document_key=document_key, data=payload.data or {})
        db.add(document)
    else:
        document.data = payload.data or {}
    db.commit()
    db.refresh(document)
    return ContentDocumentResponse(key=document_key, data=document.data or {}, updated_at=document.updated_at)
