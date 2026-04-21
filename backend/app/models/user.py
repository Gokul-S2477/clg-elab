import enum
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Enum, ForeignKey, Integer, String, Text, Boolean
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
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


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


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("class_rooms.id"), nullable=True)
    year = Column(Integer, nullable=True)
    data = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")
    department = relationship("Department")
    classroom = relationship("ClassRoom", foreign_keys=[class_id])





class ClassRoom(Base):
    __tablename__ = "class_rooms"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Section A"
    year = Column(Integer, nullable=False)  # e.g. 1, 2, 3, 4
    
    department = relationship("Department")


class FacultyMapping(Base):
    __tablename__ = "faculty_mappings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("class_rooms.id"), nullable=True)
    is_incharge = Column(Boolean, default=False)
    
    user = relationship("User")
    department = relationship("Department")
    classroom = relationship("ClassRoom")


class AppPreference(Base):
    __tablename__ = "app_preferences"

    id = Column(Integer, primary_key=True, index=True)
    preference_key = Column(String(100), nullable=False, unique=True, index=True)
    data = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AppContentDocument(Base):
    __tablename__ = "app_content_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_key = Column(String(100), nullable=False, unique=True, index=True)
    data = Column(JSON, nullable=False, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
