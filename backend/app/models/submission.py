from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.db import Base
from datetime import datetime

class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    instructions = Column(Text)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("class_rooms.id"), nullable=True)
    due_date = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False) # Code or Essay
    status = Column(String(50), default="pending") # pending, graded
    score = Column(Float, nullable=True)
    ai_feedback = Column(JSON, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    assignment = relationship("Assignment")
    student = relationship("User")
