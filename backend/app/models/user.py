import enum
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class UserRole(enum.Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"
    super_admin = "super_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.student)
    playground_saves = relationship("PlaygroundSave", back_populates="user", cascade="all, delete-orphan")


class PlaygroundSave(Base):
    __tablename__ = "playground_saves"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    module = Column(String(40), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    language = Column(String(40), nullable=False, default="python")
    code = Column(Text, nullable=False)
    extra = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="playground_saves")
