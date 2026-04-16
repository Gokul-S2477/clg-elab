from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.crypto import verify_secret
from app.db import get_db
from app.models.user import User, UserProfile, UserRole


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginPayload(BaseModel):
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str
    role: str


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    if payload.role not in UserRole.__members__:
        raise HTTPException(status_code=400, detail="Invalid role")

    login_value = (payload.identifier or payload.email or "").strip().lower()
    if not login_value:
        raise HTTPException(status_code=400, detail="Identifier is required")

    users = db.query(User).filter(User.role == UserRole[payload.role]).all()
    matched_user = None
    for user in users:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        valid_identifiers = {
            user.email.lower(),
            str(profile.data.get("identifier", "")).lower() if profile and profile.data else "",
        }
        if login_value in valid_identifiers and verify_secret(payload.password, user.password):
            matched_user = (user, profile)
            break

    if not matched_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user, profile = matched_user
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "identifier": profile.data.get("identifier") if profile and profile.data else None,
            "department": profile.data.get("department") if profile and profile.data else None,
            "profile": profile.data if profile else {},
        },
        "access_token": f"local-token-{user.id}",
        "token_type": "bearer",
    }
