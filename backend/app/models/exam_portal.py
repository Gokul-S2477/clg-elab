import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class ExamStatus(enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    published = "published"
    archived = "archived"


class AttemptStatus(enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    submitted = "submitted"
    auto_submitted = "auto_submitted"


class AccessScope(enum.Enum):
    department = "department"
    selected_students = "selected_students"
    hybrid = "hybrid"


class QuestionKind(enum.Enum):
    mcq = "mcq"
    written = "written"
    coding = "coding"
    sql = "sql"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    question_type = Column(Enum(QuestionKind), nullable=False)
    difficulty = Column(String(30), nullable=False, default="medium")
    tags = Column(JSON, default=[])
    prompt = Column(Text, nullable=False)
    instructions = Column(Text, default="")
    options = Column(JSON, default=[])
    correct_answers = Column(JSON, default=[])
    evaluation_guide = Column(Text, default="")
    answer_schema = Column(JSON, default={})
    question_metadata = Column("metadata", JSON, default={})
    points = Column(Integer, nullable=False, default=10)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    instructions = Column(Text, default="")
    exam_password = Column(String(255), nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    status = Column(Enum(ExamStatus), nullable=False, default=ExamStatus.draft)
    access_scope = Column(Enum(AccessScope), nullable=False, default=AccessScope.hybrid)
    shuffle_questions = Column(Boolean, default=False)
    shuffle_mcq_options = Column(Boolean, default=False)
    allow_late_entry = Column(Boolean, default=False)
    late_entry_grace_minutes = Column(Integer, default=0)
    show_score_immediately = Column(Boolean, default=False)
    auto_submit_enabled = Column(Boolean, default=True)
    total_marks = Column(Integer, default=0)
    settings = Column(JSON, default={})
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    question_links = relationship("ExamQuestionLink", back_populates="exam", cascade="all, delete-orphan")
    faculty_access = relationship("ExamFacultyAccess", back_populates="exam", cascade="all, delete-orphan")
    student_assignments = relationship("ExamStudentAssignment", back_populates="exam", cascade="all, delete-orphan")
    attempts = relationship("ExamAttempt", back_populates="exam", cascade="all, delete-orphan")
    logs = relationship("ExamActivityLog", back_populates="exam", cascade="all, delete-orphan")


class ExamQuestionLink(Base):
    __tablename__ = "exam_question_links"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("exam_questions.id"), nullable=False, index=True)
    section_name = Column(String(255), default="Main Section")
    order_index = Column(Integer, default=0)
    points = Column(Integer, nullable=False, default=10)
    required = Column(Boolean, default=True)
    settings = Column(JSON, default={})

    exam = relationship("Exam", back_populates="question_links")
    question = relationship("ExamQuestion")


class ExamFacultyAccess(Base):
    __tablename__ = "exam_faculty_access"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    can_manage = Column(Boolean, default=False)
    can_test = Column(Boolean, default=True)
    can_review = Column(Boolean, default=True)
    can_download = Column(Boolean, default=True)

    exam = relationship("Exam", back_populates="faculty_access")
    user = relationship("User")


class ExamStudentAssignment(Base):
    __tablename__ = "exam_student_assignments"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assignment_source = Column(String(30), nullable=False, default="selected")
    is_active = Column(Boolean, default=True)

    exam = relationship("Exam", back_populates="student_assignments")
    student = relationship("User")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(AttemptStatus), nullable=False, default=AttemptStatus.not_started)
    started_at = Column(DateTime)
    submitted_at = Column(DateTime)
    last_saved_at = Column(DateTime)
    password_verified_at = Column(DateTime)
    waiting_room_entered_at = Column(DateTime)
    score = Column(Integer, default=0)
    max_score = Column(Integer, default=0)
    auto_submitted = Column(Boolean, default=False)
    submission_meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    exam = relationship("Exam", back_populates="attempts")
    student = relationship("User")
    answers = relationship("ExamAttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")
    logs = relationship("ExamActivityLog", back_populates="attempt", cascade="all, delete-orphan")


class ExamAttemptAnswer(Base):
    __tablename__ = "exam_attempt_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False, index=True)
    question_link_id = Column(Integer, ForeignKey("exam_question_links.id"), nullable=False, index=True)
    answer_text = Column(Text, default="")
    selected_options = Column(JSON, default=[])
    draft_payload = Column(JSON, default={})
    score = Column(Integer, default=0)
    max_score = Column(Integer, default=0)
    is_correct = Column(Boolean)
    saved_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attempt = relationship("ExamAttempt", back_populates="answers")
    question_link = relationship("ExamQuestionLink")


class ExamActivityLog(Base):
    __tablename__ = "exam_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    actor_role = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False, index=True)
    details = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    exam = relationship("Exam", back_populates="logs")
    attempt = relationship("ExamAttempt", back_populates="logs")
    actor = relationship("User")


class ExamProctorSnapshot(Base):
    __tablename__ = "exam_proctor_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_data = Column(Text, nullable=False)
    mime_type = Column(String(100), default="image/jpeg")
    captured_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    trigger_type = Column(String(100), nullable=False, default="interval")
    face_status = Column(String(100), default="unknown")
    details = Column(JSON, default={})

    student = relationship("User")
