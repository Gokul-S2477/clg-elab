from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.db import Base
from datetime import datetime
import enum


class DifficultyLevel(enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionCategory(enum.Enum):
    coding = "coding"
    sql = "sql"
    mcq = "mcq"
    debugging = "debugging"


class QuestionVisibility(enum.Enum):
    draft = "draft"
    published = "published"
    private = "private"


class ApproachType(enum.Enum):
    brute_force = "brute_force"
    optimized = "optimized"


class ProgrammingLanguage(enum.Enum):
    python = "python"
    javascript = "javascript"
    java = "java"
    cpp = "cpp"
    sql = "sql"

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    difficulty = Column(Enum(DifficultyLevel), nullable=False, default=DifficultyLevel.medium)
    category = Column(Enum(QuestionCategory), nullable=False)
    tags = Column(JSON, default=[])
    problem_statement = Column(Text, nullable=False)
    short_description = Column(String(500))
    diagram_url = Column(String(1000))
    diagram_caption = Column(String(500))
    input_format = Column(Text)
    output_format = Column(Text)
    sql_schema = Column(Text)
    expected_output = Column(Text)
    sample_tables = Column(JSON, default=[])
    function_signature = Column(Text)
    constraints = Column(Text)
    time_limit = Column(Integer, default=1)  # in seconds
    memory_limit = Column(Integer, default=256)  # in MB
    points = Column(Integer, default=10)
    visibility = Column(Enum(QuestionVisibility), default=QuestionVisibility.draft)
    created_by = Column(Integer, nullable=False)  # user_id
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    examples = relationship("Example", back_populates="question", cascade="all, delete-orphan")
    test_cases = relationship("TestCase", back_populates="question", cascade="all, delete-orphan")
    starter_codes = relationship("StarterCode", back_populates="question", cascade="all, delete-orphan")
    solutions = relationship("Solution", back_populates="question", cascade="all, delete-orphan")


class Example(Base):
    __tablename__ = "examples"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    input = Column(Text, nullable=False)
    output = Column(Text, nullable=False)
    explanation = Column(Text)

    # Relationship
    question = relationship("Question", back_populates="examples")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    input = Column(Text, nullable=False)
    output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=False)

    # Relationship
    question = relationship("Question", back_populates="test_cases")


class StarterCode(Base):
    __tablename__ = "starter_codes"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    language = Column(Enum(ProgrammingLanguage), nullable=False)
    code = Column(Text, nullable=False)

    # Relationship
    question = relationship("Question", back_populates="starter_codes")


class Solution(Base):
    __tablename__ = "solutions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    language = Column(Enum(ProgrammingLanguage), nullable=False, default=ProgrammingLanguage.python)
    code = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    approach_type = Column(Enum(ApproachType), nullable=False, default=ApproachType.optimized)

    # Relationship
    question = relationship("Question", back_populates="solutions")
