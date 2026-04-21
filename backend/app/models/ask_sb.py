from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base

class ProjectSB(Base):
    __tablename__ = "ask_sb_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("class_rooms.id"), nullable=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sources = relationship("SourceSB", back_populates="project", cascade="all, delete-orphan")
    chats = relationship("ChatSB", back_populates="project", cascade="all, delete-orphan")

class SourceSB(Base):
    __tablename__ = "ask_sb_sources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("ask_sb_projects.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=True)
    content_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("ProjectSB", back_populates="sources")

class ChatSB(Base):
    __tablename__ = "ask_sb_chats"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("ask_sb_projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False) # 'user' or 'ai'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("ProjectSB", back_populates="chats")
