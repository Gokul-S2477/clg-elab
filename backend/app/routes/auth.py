from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.user import UserRole


router = APIRouter()


class LoginPayload(BaseModel):
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str
    role: str


MOCK_USERS = {
    "student": {
        "id": 1,
        "name": "Student One",
        "identifier": "gs9721",
        "password": "gs9721",
        "role": "student",
        "email": "gs9721@student.school",
    },
    "faculty": {
        "id": 2,
        "name": "Faculty Lead",
        "identifier": "faculty",
        "password": "faculty@123",
        "role": "faculty",
        "email": "faculty@school",
    },
    "admin": {
        "id": 3,
        "name": "Admin User",
        "identifier": "admin",
        "password": "admin@123",
        "role": "admin",
        "email": "admin@school",
    },
    "super_admin": {
        "id": 4,
        "name": "Super Admin",
        "identifier": "superadmin",
        "password": "superadmin@123",
        "role": "super_admin",
        "email": "superadmin@school",
    },
}


@router.post("/auth/login")
def login(payload: LoginPayload):
    if payload.role not in UserRole.__members__:
        raise HTTPException(status_code=400, detail="Invalid role")

    stored_user = MOCK_USERS.get(payload.role)
    if not stored_user:
        raise HTTPException(status_code=400, detail="Unsupported role")

    login_value = (payload.identifier or payload.email or "").strip()
    valid_identifiers = {stored_user["email"], stored_user["identifier"]}
    if login_value not in valid_identifiers or stored_user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "user": {
            "id": stored_user["id"],
            "name": stored_user["name"],
            "email": stored_user["email"],
            "role": stored_user["role"],
        },
        "access_token": "mock-token",
        "token_type": "bearer",
    }
