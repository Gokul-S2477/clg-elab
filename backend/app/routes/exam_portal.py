import ast
import contextlib
import csv
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import traceback
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from slugify import slugify
from sqlalchemy.orm import Session

from app.crypto import hash_secret, verify_secret
from app.db import get_db
from app.models.exam_portal import (
    AccessScope,
    AttemptStatus,
    Department,
    Exam,
    ExamActivityLog,
    ExamAttempt,
    ExamAttemptAnswer,
    ExamFacultyAccess,
    ExamQuestion,
    ExamQuestionLink,
    ExamProctorSnapshot,
    ExamStatus,
    ExamStudentAssignment,
    QuestionKind,
)
from app.models.practice_arena import Question as PracticeQuestion, QuestionCategory, QuestionVisibility
from app.models.user import User, UserProfile, UserRole
from app.security import get_current_user, get_optional_user


router = APIRouter(prefix="/portal", tags=["exam-portal"])
MEDIA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "media", "exam_questions"))
os.makedirs(MEDIA_ROOT, exist_ok=True)


def _parse_datetime(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from exc


def _profile_map(profile: Optional[UserProfile]) -> dict[str, Any]:
    return profile.data if profile and profile.data else {}


def _user_brief(user: User, profile: Optional[UserProfile]) -> dict[str, Any]:
    data = _profile_map(profile)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "identifier": data.get("identifier"),
        "department": data.get("department"),
        "batch": data.get("batch"),
        "section": data.get("section"),
        "year": data.get("year"),
    }


def _get_profile(db: Session, user_id: int) -> Optional[UserProfile]:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def _get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def _require_roles(current_user: User, allowed_roles: set[UserRole]) -> None:
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action")


def _faculty_access_for(exam: Exam, user_id: int) -> Optional[ExamFacultyAccess]:
    return next((access for access in exam.faculty_access if access.user_id == user_id), None)


def _can_manage_exam(current_user: User, exam: Exam) -> bool:
    if current_user.role in {UserRole.admin, UserRole.super_admin}:
        return True
    if exam.created_by == current_user.id:
        return True
    access = _faculty_access_for(exam, current_user.id)
    return bool(access and access.can_manage)


def _can_review_exam(current_user: User, exam: Exam) -> bool:
    if current_user.role in {UserRole.admin, UserRole.super_admin}:
        return True
    if exam.created_by == current_user.id:
        return True
    access = _faculty_access_for(exam, current_user.id)
    return bool(access and access.can_review)


def _ensure_exam_review_access(current_user: User, exam: Exam) -> None:
    if not _can_review_exam(current_user, exam):
        raise HTTPException(status_code=403, detail="You do not have access to review this exam")


def _ensure_exam_manage_access(current_user: User, exam: Exam) -> None:
    if not _can_manage_exam(current_user, exam):
        raise HTTPException(status_code=403, detail="You do not have access to manage this exam")


def _ensure_student_identity(current_user: User) -> None:
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=403, detail="Only students can perform this action")


def _ensure_attempt_owner(current_user: User, attempt: ExamAttempt) -> None:
    _ensure_student_identity(current_user)
    if attempt.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")


def _build_unique_exam_slug(db: Session, title: str, current_exam_id: Optional[int] = None) -> str:
    base_slug = slugify(title) or "exam"
    candidate = base_slug
    suffix = 2
    while True:
        query = db.query(Exam).filter(Exam.slug == candidate)
        if current_exam_id is not None:
            query = query.filter(Exam.id != current_exam_id)
        if not query.first():
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _serialize_practice_question_summary(question: PracticeQuestion) -> dict[str, Any]:
    return {
        "id": question.id,
        "title": question.title,
        "slug": question.slug,
        "category": question.category.value,
        "difficulty": question.difficulty.value,
        "tags": question.tags or [],
        "short_description": question.short_description or "",
        "points": question.points,
        "time_limit": question.time_limit,
        "visibility": question.visibility.value,
        "diagram_url": question.diagram_url,
        "diagram_caption": question.diagram_caption,
        "examples_count": len(question.examples or []),
        "test_cases_count": len(question.test_cases or []),
        "starter_languages": [starter.language.value for starter in question.starter_codes],
    }


def _map_practice_category(category: QuestionCategory) -> QuestionKind:
    if category == QuestionCategory.sql:
        return QuestionKind.sql
    if category in {QuestionCategory.coding, QuestionCategory.debugging}:
        return QuestionKind.coding
    if category == QuestionCategory.mcq:
        return QuestionKind.mcq
    return QuestionKind.written


def _build_exam_question_from_practice(question: PracticeQuestion, actor_user_id: int) -> dict[str, Any]:
    starter_code = {starter.language.value: starter.code for starter in question.starter_codes}
    visible_test_cases = [
        {"input": test_case.input, "output": test_case.output}
        for test_case in question.test_cases
        if not test_case.is_hidden
    ]
    hidden_test_cases = [
        {"input": test_case.input, "output": test_case.output}
        for test_case in question.test_cases
        if test_case.is_hidden
    ]
    metadata = {
        "source_type": "practice_arena",
        "source_question_id": question.id,
        "source_slug": question.slug,
        "source_visibility": question.visibility.value,
        "short_description": question.short_description or "",
        "image_url": question.diagram_url,
        "image_caption": question.diagram_caption or "",
        "examples": [
            {
                "input": example.input,
                "output": example.output,
                "explanation": example.explanation or "",
            }
            for example in question.examples
        ],
        "visible_test_cases": visible_test_cases,
        "hidden_test_cases": hidden_test_cases,
        "sample_tables": question.sample_tables or [],
        "expected_output": question.expected_output or "",
        "function_signature": question.function_signature or "",
        "input_format": question.input_format or "",
        "output_format": question.output_format or "",
        "constraints": question.constraints or "",
        "question_timer_minutes": question.time_limit,
        "question_origin_label": "Imported from Practice Arena",
    }
    allowed_languages = [starter.language.value for starter in question.starter_codes]
    if question.category == QuestionCategory.sql:
        allowed_languages = ["sql"]
    elif not allowed_languages:
        allowed_languages = ["python", "javascript", "java", "cpp"]
    return {
        "title": question.title,
        "question_type": _map_practice_category(question.category),
        "difficulty": question.difficulty.value,
        "tags": question.tags or [],
        "prompt": question.problem_statement,
        "instructions": question.short_description or "",
        "options": [],
        "correct_answers": [],
        "evaluation_guide": "\n".join(
            item for item in [question.input_format or "", question.output_format or "", question.constraints or ""] if item
        ),
        "answer_schema": {
            "allowed_languages": allowed_languages,
            "starter_code": starter_code,
        },
        "metadata": metadata,
        "points": question.points,
        "created_by": actor_user_id,
    }


def _validate_question_payload(payload: "QuestionPayload") -> None:
    if payload.question_type == "mcq":
        options = payload.options or []
        if len(options) < 2:
            raise HTTPException(status_code=400, detail="MCQ questions need at least 2 options")
        if len(options) > 8:
            raise HTTPException(status_code=400, detail="MCQ questions can have at most 8 options")
        option_ids = {str(option.get("id", "")).strip() for option in options if str(option.get("id", "")).strip()}
        if len(option_ids) != len(options):
            raise HTTPException(status_code=400, detail="Each MCQ option must have a unique id")
        if not payload.correct_answers:
            raise HTTPException(status_code=400, detail="Select at least one correct answer for MCQ questions")
        if any(answer not in option_ids for answer in payload.correct_answers):
            raise HTTPException(status_code=400, detail="Correct answers must match the configured MCQ options")


def _ensure_exam_timing_for_start(exam: Exam, attempt: Optional[ExamAttempt] = None) -> None:
    now = datetime.utcnow()
    if now < exam.start_time:
        raise HTTPException(status_code=403, detail="Exam has not started yet")
    if now <= exam.end_time:
        return
    if attempt and attempt.status == AttemptStatus.in_progress:
        return
    if exam.allow_late_entry and now <= exam.end_time + timedelta(minutes=exam.late_entry_grace_minutes or 0):
        return
    raise HTTPException(status_code=403, detail="Exam access window has closed")


def _validate_exam_payload(payload: "ExamPayload", *, require_password: bool) -> tuple[datetime, datetime]:
    start_time = _parse_datetime(payload.start_time)
    end_time = _parse_datetime(payload.end_time)
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="Exam end time must be after start time")
    if payload.duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="Exam duration must be greater than zero")
    if require_password and not str(payload.exam_password or "").strip():
        raise HTTPException(status_code=400, detail="Exam password is required")
    return start_time, end_time


def _student_exam_phase(exam: Exam) -> str:
    now = datetime.utcnow()
    if now < exam.start_time:
        return "waiting"
    if now > exam.end_time:
        return "review"
    return "open"


def _ensure_student_exam_live(exam: Exam) -> None:
    now = datetime.utcnow()
    if now < exam.start_time:
        raise HTTPException(status_code=403, detail="Exam has not started yet")
    if now <= exam.end_time:
        return
    if exam.allow_late_entry and now <= exam.end_time + timedelta(minutes=exam.late_entry_grace_minutes or 0):
        return
    raise HTTPException(status_code=403, detail="Exam access window has closed")


def _sanitize_question_metadata(metadata: dict[str, Any], viewer: str) -> dict[str, Any]:
    clean = dict(metadata or {})
    if viewer == "student":
        clean.pop("hidden_test_cases", None)
    return clean


def _serialize_question(question: ExamQuestion, *, viewer: str = "privileged", reveal_answers: bool = False) -> dict[str, Any]:
    metadata = _sanitize_question_metadata(question.question_metadata or {}, viewer)
    correct_answers = question.correct_answers or []
    evaluation_guide = question.evaluation_guide or ""
    if viewer == "student" and not reveal_answers:
        correct_answers = []
        evaluation_guide = ""
    return {
        "id": question.id,
        "title": question.title,
        "question_type": question.question_type.value,
        "difficulty": question.difficulty,
        "tags": question.tags or [],
        "prompt": question.prompt,
        "instructions": question.instructions or "",
        "options": question.options or [],
        "correct_answers": correct_answers,
        "evaluation_guide": evaluation_guide,
        "answer_schema": question.answer_schema or {},
        "metadata": metadata,
        "source_type": metadata.get("source_type", "exam_portal"),
        "source_question_id": metadata.get("source_question_id"),
        "image_url": metadata.get("image_url"),
        "image_caption": metadata.get("image_caption"),
        "short_description": metadata.get("short_description", ""),
        "examples": metadata.get("examples", []),
        "question_timer_minutes": metadata.get("question_timer_minutes"),
        "points": question.points,
        "created_by": question.created_by,
        "updated_at": question.updated_at.isoformat() if question.updated_at else None,
    }


def _serialize_attempt(attempt: ExamAttempt, db: Session, include_answers: bool = False) -> dict[str, Any]:
    student = db.query(User).filter(User.id == attempt.student_id).first()
    student_profile = _get_profile(db, attempt.student_id) if student else None
    payload = {
        "id": attempt.id,
        "exam_id": attempt.exam_id,
        "student": _user_brief(student, student_profile) if student else None,
        "status": attempt.status.value,
        "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "last_saved_at": attempt.last_saved_at.isoformat() if attempt.last_saved_at else None,
        "password_verified_at": attempt.password_verified_at.isoformat() if attempt.password_verified_at else None,
        "waiting_room_entered_at": attempt.waiting_room_entered_at.isoformat() if attempt.waiting_room_entered_at else None,
        "score": attempt.score,
        "max_score": attempt.max_score,
        "auto_submitted": attempt.auto_submitted,
        "submission_meta": attempt.submission_meta or {},
    }
    if include_answers:
        payload["answers"] = [
            {
                "id": answer.id,
                "question_link_id": answer.question_link_id,
                "answer_text": answer.answer_text or "",
                "selected_options": answer.selected_options or [],
                "draft_payload": answer.draft_payload or {},
                "score": answer.score,
                "max_score": answer.max_score,
                "is_correct": answer.is_correct,
                "saved_at": answer.saved_at.isoformat() if answer.saved_at else None,
            }
            for answer in attempt.answers
        ]
    return payload


def _review_policy(exam: Exam) -> dict[str, Any]:
    settings = exam.settings or {}
    allow_post_exam_review = settings.get("allow_post_exam_review")
    if allow_post_exam_review is None:
        allow_post_exam_review = True
    show_answer_key = bool(settings.get("show_answer_key_in_review", False))
    show_score = bool(settings.get("show_score_in_review", exam.show_score_immediately or allow_post_exam_review))
    return {
        "allow_post_exam_review": bool(allow_post_exam_review),
        "show_answer_key_in_review": show_answer_key,
        "show_score_in_review": show_score,
    }


def _serialize_exam(
    exam: Exam,
    db: Session,
    include_attempts: bool = False,
    *,
    viewer: str = "privileged",
    include_question_content: bool = True,
    reveal_correct_answers: bool = False,
) -> dict[str, Any]:
    creator = db.query(User).filter(User.id == exam.created_by).first()
    creator_profile = _get_profile(db, exam.created_by) if creator else None
    question_links = sorted(exam.question_links, key=lambda item: item.order_index)
    review_policy = _review_policy(exam)
    payload = {
        "id": exam.id,
        "title": exam.title,
        "slug": exam.slug,
        "description": exam.description or "",
        "instructions": exam.instructions or "",
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "duration_minutes": exam.duration_minutes,
        "status": exam.status.value,
        "access_scope": exam.access_scope.value,
        "shuffle_questions": exam.shuffle_questions,
        "shuffle_mcq_options": exam.shuffle_mcq_options,
        "allow_late_entry": exam.allow_late_entry,
        "late_entry_grace_minutes": exam.late_entry_grace_minutes,
        "show_score_immediately": exam.show_score_immediately,
        "auto_submit_enabled": exam.auto_submit_enabled,
        "total_marks": exam.total_marks,
        "question_count": len(question_links),
        "settings": exam.settings or {},
        "review_policy": review_policy,
        "created_by": _user_brief(creator, creator_profile) if creator else None,
        "published_at": exam.published_at.isoformat() if exam.published_at else None,
        "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        "question_links": (
            [
                {
                    "id": link.id,
                    "section_name": link.section_name,
                    "order_index": link.order_index,
                    "points": link.points,
                    "required": link.required,
                    "settings": link.settings or {},
                    "question_duration_minutes": (link.settings or {}).get("question_duration_minutes"),
                    "question": _serialize_question(link.question, viewer=viewer, reveal_answers=reveal_correct_answers),
                }
                for link in question_links
            ]
            if include_question_content
            else []
        ),
        "faculty_access": [],
        "assigned_students": [],
    }
    for access in exam.faculty_access:
        faculty = db.query(User).filter(User.id == access.user_id).first()
        if faculty:
            payload["faculty_access"].append(
                {
                    **_user_brief(faculty, _get_profile(db, faculty.id)),
                    "can_manage": access.can_manage,
                    "can_test": access.can_test,
                    "can_review": access.can_review,
                    "can_download": access.can_download,
                }
            )
    for assignment in exam.student_assignments:
        student = db.query(User).filter(User.id == assignment.student_id).first()
        if student:
            payload["assigned_students"].append(
                {
                    **_user_brief(student, _get_profile(db, student.id)),
                    "assignment_source": assignment.assignment_source,
                    "is_active": assignment.is_active,
                }
            )
    if include_attempts:
        payload["attempts"] = [_serialize_attempt(attempt, db) for attempt in exam.attempts]
    return payload


def _create_log(
    db: Session,
    *,
    exam_id: int,
    actor_user_id: int,
    actor_role: str,
    event_type: str,
    details: dict[str, Any],
    attempt_id: Optional[int] = None,
) -> None:
    db.add(
        ExamActivityLog(
            exam_id=exam_id,
            attempt_id=attempt_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            event_type=event_type,
            details=details,
        )
    )


def _finalize_attempt_submission(
    db: Session,
    *,
    attempt: ExamAttempt,
    actor_user_id: int,
    actor_role: str,
    auto_submitted: bool,
) -> None:
    if attempt.status in {AttemptStatus.submitted, AttemptStatus.auto_submitted}:
        return

    for answer in attempt.answers:
        link = answer.question_link
        if link and link.question.question_type.value in {"coding", "sql"} and answer.answer_text:
            language = (answer.draft_payload or {}).get("language") or ("sql" if link.question.question_type.value == "sql" else "python")
            custom_input = (answer.draft_payload or {}).get("custom_input", "")
            judged = _judge_exam_question(
                link,
                JudgeAnswerPayload(
                    student_id=attempt.student_id,
                    language=language,
                    code=answer.answer_text,
                    custom_input=custom_input,
                ),
                include_hidden=True,
            )
            answer.score = judged["score"]
            answer.max_score = judged["max_score"]
            answer.draft_payload = {
                **(answer.draft_payload or {}),
                "last_submission": judged,
                "score": judged["score"],
                "visible_passed": judged["visible_passed"],
                "visible_total": judged["visible_total"],
                "hidden_passed": judged["hidden_passed"],
                "hidden_total": judged["hidden_total"],
                "execution_time_ms": judged["execution_time_ms"],
                "test_case_results": judged["test_case_results"],
            }
        score, max_score = _score_attempt_answer(answer, link)
        answer.score = score
        answer.max_score = max_score

    total_score = sum(answer.score or 0 for answer in attempt.answers)
    total_max = sum(answer.max_score or (answer.question_link.points if answer.question_link else 0) for answer in attempt.answers)
    attempt.score = total_score
    attempt.max_score = total_max
    attempt.last_saved_at = datetime.utcnow()
    attempt.submitted_at = datetime.utcnow()
    attempt.auto_submitted = auto_submitted
    attempt.status = AttemptStatus.auto_submitted if auto_submitted else AttemptStatus.submitted
    _create_log(
        db,
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        event_type="attempt_auto_submitted" if auto_submitted else "attempt_submitted",
        details={"score": total_score, "max_score": total_max},
    )


def _eligible_students_for_departments(db: Session, department_codes: list[str]) -> list[int]:
    student_ids = []
    students = db.query(User).filter(User.role == UserRole.student).all()
    for student in students:
        profile = _get_profile(db, student.id)
        if (_profile_map(profile).get("department") or "") in department_codes:
            student_ids.append(student.id)
    return student_ids


def _ensure_exam_access(exam: Exam, student_id: int) -> bool:
    active_assignments = {assignment.student_id for assignment in exam.student_assignments if assignment.is_active}
    return student_id in active_assignments


def _normalize_text(value: Optional[str]) -> str:
    return "\n".join(line.strip() for line in str(value or "").splitlines() if line.strip())


def _parse_execution_input(raw: str):
    args = []
    kwargs = {}
    text = (raw or "").strip()
    if not text:
        return args, kwargs

    def _safe_eval(value: str):
        try:
            return ast.literal_eval(value)
        except Exception:
            return value.strip()

    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, dict):
            kwargs.update(parsed)
            return args, kwargs
        if isinstance(parsed, (list, tuple)):
            args.extend(parsed)
            return args, kwargs
        args.append(parsed)
        return args, kwargs
    except Exception:
        pass

    for line in (segment.strip() for segment in text.splitlines() if segment.strip()):
        if "=" in line:
            key, value = line.split("=", 1)
            kwargs[key.strip()] = _safe_eval(value)
        else:
            args.append(_safe_eval(line))
    return args, kwargs


def _can_call_without_args(func) -> bool:
    try:
        import inspect

        signature = inspect.signature(func)
    except (ValueError, TypeError):
        return False
    for param in signature.parameters.values():
        if param.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD) and param.default is inspect._empty:
            return False
    return True


def _run_python_code(code: str, stdin: Optional[str]):
    start = time.perf_counter()
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    env: dict[str, object] = {"__name__": "__main__"}
    with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
        original_stdin = sys.stdin
        sys.stdin = io.StringIO(stdin or "")
        try:
            exec(code or "", env)
            solve = env.get("solve")
            args, kwargs = _parse_execution_input(stdin)
            if callable(solve):
                if args or kwargs:
                    result = solve(*args, **kwargs)
                elif _can_call_without_args(solve):
                    result = solve()
                else:
                    raise TypeError("solve() requires arguments but none were provided")
                if result is not None:
                    print(result)
        except Exception:
            stderr_buf.write(traceback.format_exc())
        finally:
            sys.stdin = original_stdin
    runtime = (time.perf_counter() - start) * 1000
    output = stdout_buf.getvalue()
    errors = stderr_buf.getvalue()
    status = "success" if not errors else "error"
    return output, errors or None, runtime, status


def _run_javascript_code(code: str, stdin: Optional[str]):
    start = time.perf_counter()
    args, kwargs = _parse_execution_input(stdin)
    harness = f"""
const fs = require('fs');
const input = {json.dumps(stdin or "")};
let userSolve = null;
{code or ""}
if (typeof solve === 'function') {{
  userSolve = solve;
}}
if (!userSolve) {{
  console.error('solve function not found');
  process.exit(1);
}}
const args = {json.dumps(args)};
const kwargs = {json.dumps(kwargs)};
let result;
if (args.length > 0) {{
  result = userSolve(...args);
}} else if (Object.keys(kwargs).length > 0) {{
  result = userSolve(kwargs);
}} else {{
  result = userSolve();
}}
if (typeof result !== 'undefined') {{
  if (typeof result === 'object') {{
    console.log(JSON.stringify(result));
  }} else {{
    console.log(result);
  }}
}}
"""
    try:
        result = subprocess.run(
            ["node", "-e", harness],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        runtime = (time.perf_counter() - start) * 1000
        output = result.stdout
        errors = result.stderr or None
        status = "success" if result.returncode == 0 and not errors else "error"
        return output, errors, runtime, status
    except FileNotFoundError:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", "Node.js runtime is not installed on this server.", runtime, "error"
    except subprocess.TimeoutExpired:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", "Execution timed out.", runtime, "error"


def _run_compiled_language(language: str, code: str, stdin: Optional[str]):
    runtime_labels = {
        "c": "C compiler",
        "cpp": "C++ compiler",
        "java": "Java compiler/runtime",
    }
    return "(no output)\n", f"{runtime_labels.get(language, language)} is not installed on this server.", 0.0, "error"


def _coerce_sql_value(value):
    if value in (None, "", "NULL", "null"):
        return None
    return value


def _sqlite_datediff(left, right):
    try:
        first = datetime.fromisoformat(str(left))
        second = datetime.fromisoformat(str(right))
        return (first - second).days
    except Exception:
        return None


def _sqlite_date_format(value, pattern):
    try:
        date_value = datetime.fromisoformat(str(value))
        mapping = str(pattern).replace("%i", "%M")
        return date_value.strftime(mapping)
    except Exception:
        return None


def _sqlite_date_sub(value, amount, unit):
    try:
        date_value = datetime.fromisoformat(str(value))
        amount_value = int(amount)
        unit_value = str(unit or "").strip().lower()
        if unit_value.startswith("day"):
            return (date_value - timedelta(days=amount_value)).strftime("%Y-%m-%d")
        if unit_value.startswith("month"):
            month = date_value.month - amount_value
            year = date_value.year
            while month <= 0:
                month += 12
                year -= 1
            return date_value.replace(year=year, month=month).strftime("%Y-%m-%d")
        return None
    except Exception:
        return None


def _prepare_sql_query(code: str) -> str:
    query = str(code or "").strip()
    query = re.sub(
        r"DATE_SUB\s*\(\s*([a-zA-Z0-9_.\"`]+)\s*,\s*INTERVAL\s+([0-9]+)\s+DAY\s*\)",
        r"DATE(\1, '-' || \2 || ' day')",
        query,
        flags=re.IGNORECASE,
    )
    query = re.sub(
        r"DATE_SUB\s*\(\s*([a-zA-Z0-9_.\"`]+)\s*,\s*INTERVAL\s+([0-9]+)\s+MONTH\s*\)",
        r"DATE(\1, '-' || \2 || ' month')",
        query,
        flags=re.IGNORECASE,
    )
    return query


def _split_sql_script(code: str) -> tuple[list[str], str]:
    statements: list[str] = []
    buffer = ""
    for char in str(code or ""):
        buffer += char
        candidate = buffer.strip()
        if candidate and sqlite3.complete_statement(candidate):
            statements.append(candidate.rstrip(";").strip())
            buffer = ""
    trailing = buffer.strip()
    if trailing:
        statements.append(trailing.rstrip(";").strip())
    if not statements:
        return [], ""
    if len(statements) == 1:
        return [], statements[0]
    return statements[:-1], statements[-1]


def _create_sqlite_table(cursor, table):
    name = table.get("name")
    columns = table.get("columns", [])
    rows = table.get("rows", [])
    if not name or not columns:
        return
    quoted_columns = ", ".join(f'"{column}" TEXT' for column in columns)
    cursor.execute(f'DROP TABLE IF EXISTS "{name}"')
    cursor.execute(f'CREATE TABLE "{name}" ({quoted_columns})')
    if rows:
        placeholders = ", ".join("?" for _ in columns)
        quoted_names = ", ".join(f'"{column}"' for column in columns)
        cursor.executemany(
            f'INSERT INTO "{name}" ({quoted_names}) VALUES ({placeholders})',
            [[_coerce_sql_value(cell) for cell in row] for row in rows],
        )


def _format_sql_rows(cursor, rows):
    if cursor.description:
        headers = [column[0] for column in cursor.description]
        lines = [" | ".join(headers)]
        lines.extend(" | ".join("" if cell is None else str(cell) for cell in row) for row in rows)
        return "\n".join(lines)
    return "Query executed successfully."


def _run_sql_query(code: str, sample_tables: list[dict[str, Any]]):
    start = time.perf_counter()
    if not sample_tables:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", "Sample tables are not available for this SQL question yet.", runtime, "error"
    connection = sqlite3.connect(":memory:")
    connection.create_function("DATEDIFF", 2, _sqlite_datediff)
    connection.create_function("DATE_FORMAT", 2, _sqlite_date_format)
    connection.create_function("DATE_SUB", 3, _sqlite_date_sub)
    cursor = connection.cursor()
    try:
        for table in sample_tables:
            _create_sqlite_table(cursor, table)
        prepared = _prepare_sql_query(code)
        setup_statements, final_statement = _split_sql_script(prepared)
        for statement in setup_statements:
            if statement:
                cursor.execute(statement)
        if not final_statement:
            connection.commit()
            runtime = (time.perf_counter() - start) * 1000
            return "Query executed successfully.", None, runtime, "success"
        cursor.execute(final_statement)
        rows = cursor.fetchall() if cursor.description else []
        connection.commit()
        output = _format_sql_rows(cursor, rows) if cursor.description else "Query executed successfully."
        runtime = (time.perf_counter() - start) * 1000
        return output, None, runtime, "success"
    except Exception as exc:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", str(exc), runtime, "error"
    finally:
        connection.close()


def _evaluate_runtime(language: str, code: str, stdin: Optional[str], sample_tables: Optional[list[dict[str, Any]]] = None):
    normalized = str(language or "").lower()
    if normalized == "python":
        return _run_python_code(code, stdin)
    if normalized in {"javascript", "js"}:
        return _run_javascript_code(code, stdin)
    if normalized in {"c", "cpp", "java"}:
        return _run_compiled_language(normalized, code, stdin)
    if normalized == "sql":
        return _run_sql_query(code, sample_tables or [])
    return "(no output)\n", f"Unsupported language: {language}", 0.0, "error"


def _score_attempt_answer(answer: ExamAttemptAnswer, link: ExamQuestionLink) -> tuple[int, int]:
    question_type = link.question.question_type.value
    max_score = link.points
    if question_type == "mcq":
        correct = sorted(link.question.correct_answers or [])
        selected = sorted(answer.selected_options or [])
        score = max_score if correct == selected else 0
        answer.is_correct = correct == selected
        return score, max_score
    if question_type in {"coding", "sql"}:
        draft_payload = answer.draft_payload or {}
        return int(draft_payload.get("score", 0) or 0), max_score
    # written/manual review
    return int(answer.score or 0), max_score


def _cleanup_expired_snapshots(db: Session) -> None:
    db.query(ExamProctorSnapshot).filter(ExamProctorSnapshot.expires_at <= datetime.utcnow()).delete()
    db.flush()


def _get_question_runtime_config(question: ExamQuestion) -> dict[str, Any]:
    schema = question.answer_schema or {}
    metadata = question.question_metadata or {}
    return {
        "allowed_languages": schema.get("allowed_languages", []),
        "starter_code": schema.get("starter_code", {}),
        "visible_test_cases": metadata.get("visible_test_cases", []),
        "hidden_test_cases": metadata.get("hidden_test_cases", []),
        "sample_tables": metadata.get("sample_tables", []),
        "expected_output": metadata.get("expected_output", ""),
    }


def _judge_exam_question(link: ExamQuestionLink, payload: JudgeAnswerPayload, include_hidden: bool) -> dict[str, Any]:
    question = link.question
    config = _get_question_runtime_config(question)
    allowed_languages = [str(item).lower() for item in config.get("allowed_languages", [])]
    language = payload.language.lower()
    if question.question_type.value == "sql":
        language = "sql"
    if allowed_languages and language not in allowed_languages:
        return {
            "output": "(no output)\n",
            "status": "error",
            "errors": f"Language '{payload.language}' is not allowed for this question.",
            "execution_time_ms": 0.0,
            "visible_total": 0,
            "visible_passed": 0,
            "hidden_total": 0,
            "hidden_passed": 0,
            "score": 0,
            "max_score": link.points,
            "test_case_results": [],
        }

    if question.question_type.value == "sql":
        output, errors, runtime, status = _evaluate_runtime(language, payload.code, payload.custom_input, config.get("sample_tables", []))
        visible_expected = config.get("expected_output", "")
        passed = status == "success" and _normalize_text(output) == _normalize_text(visible_expected)
        return {
            "output": output,
            "status": "success" if passed else "error",
            "errors": None if passed else (errors or "Query result did not match the expected output."),
            "execution_time_ms": runtime,
            "visible_total": 1,
            "visible_passed": 1 if passed else 0,
            "hidden_total": 0,
            "hidden_passed": 0,
            "score": link.points if passed and include_hidden else (link.points if passed else 0),
            "max_score": link.points,
            "test_case_results": [
                {
                    "id": 1,
                    "actual_output": output.strip() or "(no output)",
                    "expected_output": visible_expected,
                    "passed": passed,
                    "is_hidden": False,
                }
            ],
        }

    visible_cases = config.get("visible_test_cases", [])
    hidden_cases = config.get("hidden_test_cases", []) if include_hidden else []
    all_cases = [(case, False) for case in visible_cases] + [(case, True) for case in hidden_cases]
    if not all_cases:
        output, errors, runtime, status = _evaluate_runtime(language, payload.code, payload.custom_input)
        return {
            "output": output,
            "status": status,
            "errors": errors,
            "execution_time_ms": runtime,
            "visible_total": 0,
            "visible_passed": 0,
            "hidden_total": 0,
            "hidden_passed": 0,
            "score": 0,
            "max_score": link.points,
            "test_case_results": [],
        }

    visible_total = visible_passed = hidden_total = hidden_passed = 0
    test_case_results = []
    combined_output = "(no output)\n"
    combined_errors = None
    total_runtime = 0.0
    for index, (case, is_hidden) in enumerate(all_cases, start=1):
        output, errors, runtime, status = _evaluate_runtime(language, payload.code, case.get("input", ""))
        total_runtime += runtime
        actual = (output or "").strip()
        expected = (case.get("output") or "").strip()
        passed = status == "success" and not errors and actual == expected
        if index == 1:
            combined_output = output
            combined_errors = errors
        if is_hidden:
            hidden_total += 1
            if passed:
                hidden_passed += 1
        else:
            visible_total += 1
            if passed:
                visible_passed += 1
        test_case_results.append(
            {
                "id": index,
                "actual_output": actual,
                "expected_output": expected,
                "passed": passed,
                "is_hidden": is_hidden,
            }
        )
    total_cases = visible_total + hidden_total
    total_passed = visible_passed + hidden_passed
    score = round(link.points * (total_passed / total_cases)) if total_cases else 0
    return {
        "output": combined_output,
        "status": "success" if total_cases and total_passed == total_cases else "error",
        "errors": combined_errors if total_passed == total_cases else (combined_errors or "One or more test cases failed."),
        "execution_time_ms": total_runtime,
        "visible_total": visible_total,
        "visible_passed": visible_passed,
        "hidden_total": hidden_total,
        "hidden_passed": hidden_passed,
        "score": score,
        "max_score": link.points,
        "test_case_results": test_case_results,
    }


class QuestionPayload(BaseModel):
    title: str
    question_type: str
    difficulty: str = "medium"
    tags: list[str] = Field(default_factory=list)
    prompt: str
    instructions: str = ""
    options: list[dict[str, Any]] = Field(default_factory=list)
    correct_answers: list[str] = Field(default_factory=list)
    evaluation_guide: str = ""
    answer_schema: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    points: int = 10
    created_by: int


class ExamLinkPayload(BaseModel):
    question_id: int
    section_name: str = "Main Section"
    order_index: int
    points: int = 10
    required: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)


class FacultyAccessPayload(BaseModel):
    user_id: int
    can_manage: bool = False
    can_test: bool = True
    can_review: bool = True
    can_download: bool = True


class ImportPracticeQuestionsPayload(BaseModel):
    question_ids: list[int] = Field(default_factory=list)


class ExamPayload(BaseModel):
    title: str
    description: str = ""
    instructions: str = ""
    exam_password: str
    start_time: str
    end_time: str
    duration_minutes: int
    status: str = "draft"
    access_scope: str = "hybrid"
    shuffle_questions: bool = False
    shuffle_mcq_options: bool = False
    allow_late_entry: bool = False
    late_entry_grace_minutes: int = 0
    show_score_immediately: bool = False
    auto_submit_enabled: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)
    created_by: int
    question_links: list[ExamLinkPayload] = Field(default_factory=list)
    faculty_access: list[FacultyAccessPayload] = Field(default_factory=list)
    selected_student_ids: list[int] = Field(default_factory=list)
    selected_department_codes: list[str] = Field(default_factory=list)


class WaitRoomPayload(BaseModel):
    student_id: int


class VerifyPasswordPayload(BaseModel):
    student_id: int
    exam_password: str


class StartAttemptPayload(BaseModel):
    student_id: int


class SaveAnswerPayload(BaseModel):
    student_id: int
    answers: list[dict[str, Any]] = Field(default_factory=list)


class SubmitAttemptPayload(BaseModel):
    student_id: int
    auto_submitted: bool = False


class EventPayload(BaseModel):
    actor_user_id: int
    actor_role: str
    event_type: str
    details: dict[str, Any] = Field(default_factory=dict)


class JudgeAnswerPayload(BaseModel):
    student_id: int
    language: str
    code: str
    custom_input: str = ""


class JudgeResponse(BaseModel):
    output: str
    status: str
    errors: Optional[str] = None
    execution_time_ms: float
    visible_total: int = 0
    visible_passed: int = 0
    hidden_total: int = 0
    hidden_passed: int = 0
    score: int = 0
    max_score: int = 0
    test_case_results: list[dict[str, Any]] = Field(default_factory=list)


class SnapshotPayload(BaseModel):
    student_id: int
    image_data: str
    mime_type: str = "image/jpeg"
    trigger_type: str = "interval"
    face_status: str = "unknown"
    details: dict[str, Any] = Field(default_factory=dict)


def _csv_template_text() -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "title",
        "question_type",
        "difficulty",
        "points",
        "tags",
        "short_description",
        "prompt",
        "instructions",
        "image_url",
        "image_caption",
        "question_timer_minutes",
        "evaluation_guide",
        "input_format",
        "output_format",
        "constraints",
        "function_signature",
        "mcq_options",
        "correct_answers",
        "allowed_languages",
        "visible_test_cases",
        "hidden_test_cases",
        "examples",
        "sample_tables",
        "expected_output",
        "starter_python",
        "starter_javascript",
        "starter_java",
        "starter_cpp",
        "starter_c",
        "starter_sql",
    ])
    writer.writerow([
        "Binary Search Basics",
        "coding",
        "easy",
        "10",
        "arrays,search",
        "Warmup search problem",
        "Given a sorted array, return the index of target.",
        "Write a solve function.",
        "",
        "",
        "15",
        "",
        "nums, target",
        "index or -1",
        "1 <= n <= 1e5",
        "solve(nums, target)",
        "",
        "",
        "python|javascript",
        '[{"input":"[[1,2,3],2]","output":"1"}]',
        '[{"input":"[[1,2,3],4]","output":"-1"}]',
        '[{"input":"[1,2,3],2","output":"1","explanation":"2 is at index 1"}]',
        "",
        "",
        "def solve(nums, target):\n    return -1",
        "function solve(nums, target) {\n  return -1;\n}",
        "",
        "",
        "",
        "",
    ])
    return output.getvalue()


def _parse_bulk_json_field(value: Optional[str], fallback):
    text = str(value or "").strip()
    if not text:
        return fallback
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON field in bulk import: {text[:80]}") from exc


def _parse_bulk_csv_row(row: dict[str, str], created_by: int) -> QuestionPayload:
    question_type = str(row.get("question_type", "mcq")).strip().lower() or "mcq"
    tags = [item.strip() for item in str(row.get("tags", "")).split(",") if item.strip()]
    options = []
    correct_answers = [item.strip() for item in str(row.get("correct_answers", "")).split(",") if item.strip()]
    if question_type == "mcq":
        option_labels = [item.strip() for item in str(row.get("mcq_options", "")).split("|") if item.strip()]
        options = [{"id": chr(97 + index), "label": label} for index, label in enumerate(option_labels)]
    allowed_languages = [item.strip() for item in str(row.get("allowed_languages", "")).split("|") if item.strip()]
    starter_code = {
        "python": row.get("starter_python", "") or "",
        "javascript": row.get("starter_javascript", "") or "",
        "java": row.get("starter_java", "") or "",
        "cpp": row.get("starter_cpp", "") or "",
        "c": row.get("starter_c", "") or "",
        "sql": row.get("starter_sql", "") or "",
    }
    metadata = {
        "short_description": row.get("short_description", "") or "",
        "image_url": row.get("image_url", "") or "",
        "image_caption": row.get("image_caption", "") or "",
        "examples": _parse_bulk_json_field(row.get("examples"), []),
        "visible_test_cases": _parse_bulk_json_field(row.get("visible_test_cases"), []),
        "hidden_test_cases": _parse_bulk_json_field(row.get("hidden_test_cases"), []),
        "sample_tables": _parse_bulk_json_field(row.get("sample_tables"), []),
        "expected_output": row.get("expected_output", "") or "",
        "input_format": row.get("input_format", "") or "",
        "output_format": row.get("output_format", "") or "",
        "constraints": row.get("constraints", "") or "",
        "function_signature": row.get("function_signature", "") or "",
        "question_timer_minutes": int(row["question_timer_minutes"]) if str(row.get("question_timer_minutes", "")).strip() else None,
        "source_type": "exam_portal",
    }
    answer_schema = {
        "allowed_languages": ["sql"] if question_type == "sql" else allowed_languages,
        "starter_code": {key: value for key, value in starter_code.items() if value.strip()},
        "selection_mode": "multiple" if len(correct_answers) > 1 else "single",
    }
    return QuestionPayload(
        title=str(row.get("title", "")).strip(),
        question_type=question_type,
        difficulty=str(row.get("difficulty", "medium")).strip() or "medium",
        tags=tags,
        prompt=str(row.get("prompt", "")).strip(),
        instructions=str(row.get("instructions", "")).strip(),
        options=options,
        correct_answers=correct_answers,
        evaluation_guide=str(row.get("evaluation_guide", "")).strip(),
        answer_schema=answer_schema,
        metadata=metadata,
        points=int(str(row.get("points", "10")).strip() or "10"),
        created_by=created_by,
    )


@router.get("/bootstrap")
def bootstrap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.query(User).all()
    profiles = {profile.user_id: profile for profile in db.query(UserProfile).all()}
    departments = db.query(Department).order_by(Department.name).all()
    exam_questions = db.query(ExamQuestion).order_by(ExamQuestion.updated_at.desc()).all() if current_user.role != UserRole.student else []
    practice_questions = (
        db.query(PracticeQuestion)
        .filter(PracticeQuestion.visibility.in_([QuestionVisibility.published, QuestionVisibility.draft]))
        .order_by(PracticeQuestion.updated_at.desc())
        .all()
        if current_user.role != UserRole.student
        else []
    )
    exams = db.query(Exam).order_by(Exam.start_time.desc()).all()
    if current_user.role == UserRole.student:
        exams = [exam for exam in exams if _ensure_exam_access(exam, current_user.id)]
    elif current_user.role == UserRole.faculty:
        exams = [exam for exam in exams if _can_review_exam(current_user, exam) or _can_manage_exam(current_user, exam)]
    return {
        "current_user": _user_brief(current_user, profiles.get(current_user.id)) if current_user else None,
        "departments": [{"id": item.id, "code": item.code, "name": item.name} for item in departments],
        "students": [_user_brief(user, profiles.get(user.id)) for user in users if user.role == UserRole.student] if current_user.role != UserRole.student else [],
        "faculty": [_user_brief(user, profiles.get(user.id)) for user in users if user.role in {UserRole.faculty, UserRole.admin, UserRole.super_admin}] if current_user.role != UserRole.student else [],
        "question_bank": [_serialize_question(question) for question in exam_questions],
        "practice_bank": [_serialize_practice_question_summary(question) for question in practice_questions],
        "exams": [_serialize_exam(exam, db) for exam in exams],
    }


@router.get("/questions")
def list_questions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    questions = db.query(ExamQuestion).order_by(ExamQuestion.updated_at.desc()).all()
    return {"items": [_serialize_question(question) for question in questions]}


@router.get("/questions/bulk-template")
def download_bulk_template(current_user: User = Depends(get_current_user)):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    return PlainTextResponse(_csv_template_text(), media_type="text/csv")


@router.post("/question-assets/image")
def upload_question_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    content_type = str(image.content_type or "").lower()
    if content_type not in {"image/png", "image/jpeg", "image/jpg", "image/webp"}:
        raise HTTPException(status_code=400, detail="Supported image formats are PNG, JPG, and WEBP")
    extension = os.path.splitext(image.filename or "")[1].lower() or ".png"
    safe_name = f"{uuid.uuid4().hex}{extension}"
    target_path = os.path.join(MEDIA_ROOT, safe_name)
    with open(target_path, "wb") as target:
        target.write(image.file.read())
    return {"url": f"http://127.0.0.1:8000/media/exam_questions/{safe_name}", "filename": safe_name}


@router.post("/questions")
def create_question(payload: QuestionPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    if payload.question_type not in QuestionKind.__members__:
        raise HTTPException(status_code=400, detail="Unsupported question type")
    _validate_question_payload(payload)
    question = ExamQuestion(
        title=payload.title,
        question_type=QuestionKind[payload.question_type],
        difficulty=payload.difficulty,
        tags=payload.tags,
        prompt=payload.prompt,
        instructions=payload.instructions,
        options=payload.options,
        correct_answers=payload.correct_answers,
        evaluation_guide=payload.evaluation_guide,
        answer_schema=payload.answer_schema,
        question_metadata=payload.metadata,
        points=payload.points,
        created_by=current_user.id,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return _serialize_question(question)


@router.put("/questions/{question_id}")
def update_question(question_id: int, payload: QuestionPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    question = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if current_user.role == UserRole.faculty and question.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can edit only your own questions")
    if payload.question_type not in QuestionKind.__members__:
        raise HTTPException(status_code=400, detail="Unsupported question type")
    _validate_question_payload(payload)
    question.title = payload.title
    question.question_type = QuestionKind[payload.question_type]
    question.difficulty = payload.difficulty
    question.tags = payload.tags
    question.prompt = payload.prompt
    question.instructions = payload.instructions
    question.options = payload.options
    question.correct_answers = payload.correct_answers
    question.evaluation_guide = payload.evaluation_guide
    question.answer_schema = payload.answer_schema
    question.question_metadata = payload.metadata
    question.points = payload.points
    db.commit()
    db.refresh(question)
    return _serialize_question(question)


@router.post("/questions/import-practice")
def import_practice_questions(
    payload: ImportPracticeQuestionsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    imported_items = []
    for question_id in payload.question_ids:
        practice_question = db.query(PracticeQuestion).filter(PracticeQuestion.id == question_id).first()
        if not practice_question:
            continue
        existing = (
            db.query(ExamQuestion)
            .filter(ExamQuestion.created_by == current_user.id)
            .all()
        )
        matched = next(
            (
                item
                for item in existing
                if (item.question_metadata or {}).get("source_type") == "practice_arena"
                and (item.question_metadata or {}).get("source_question_id") == practice_question.id
            ),
            None,
        )
        mapped = _build_exam_question_from_practice(practice_question, current_user.id)
        if matched:
            matched.title = mapped["title"]
            matched.question_type = mapped["question_type"]
            matched.difficulty = mapped["difficulty"]
            matched.tags = mapped["tags"]
            matched.prompt = mapped["prompt"]
            matched.instructions = mapped["instructions"]
            matched.options = mapped["options"]
            matched.correct_answers = mapped["correct_answers"]
            matched.evaluation_guide = mapped["evaluation_guide"]
            matched.answer_schema = mapped["answer_schema"]
            matched.question_metadata = mapped["metadata"]
            matched.points = mapped["points"]
            imported_items.append(matched)
            continue
        exam_question = ExamQuestion(
            title=mapped["title"],
            question_type=mapped["question_type"],
            difficulty=mapped["difficulty"],
            tags=mapped["tags"],
            prompt=mapped["prompt"],
            instructions=mapped["instructions"],
            options=mapped["options"],
            correct_answers=mapped["correct_answers"],
            evaluation_guide=mapped["evaluation_guide"],
            answer_schema=mapped["answer_schema"],
            question_metadata=mapped["metadata"],
            points=mapped["points"],
            created_by=current_user.id,
        )
        db.add(exam_question)
        imported_items.append(exam_question)
    db.commit()
    return {"items": [_serialize_question(item) for item in imported_items]}


@router.post("/questions/bulk-import")
def bulk_import_questions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    try:
        content = file.file.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Bulk import file must be UTF-8 encoded") from exc
    reader = csv.DictReader(io.StringIO(content))
    imported = []
    for row in reader:
        if not any(str(value or "").strip() for value in row.values()):
            continue
        payload = _parse_bulk_csv_row(row, current_user.id)
        _validate_question_payload(payload)
        question = ExamQuestion(
            title=payload.title,
            question_type=QuestionKind[payload.question_type],
            difficulty=payload.difficulty,
            tags=payload.tags,
            prompt=payload.prompt,
            instructions=payload.instructions,
            options=payload.options,
            correct_answers=payload.correct_answers,
            evaluation_guide=payload.evaluation_guide,
            answer_schema=payload.answer_schema,
            question_metadata=payload.metadata,
            points=payload.points,
            created_by=current_user.id,
        )
        db.add(question)
        imported.append(question)
    db.commit()
    return {"items": [_serialize_question(question) for question in imported]}


def _sync_exam_relationships(db: Session, exam: Exam, payload: ExamPayload) -> None:
    db.query(ExamQuestionLink).filter(ExamQuestionLink.exam_id == exam.id).delete()
    db.query(ExamFacultyAccess).filter(ExamFacultyAccess.exam_id == exam.id).delete()
    db.query(ExamStudentAssignment).filter(ExamStudentAssignment.exam_id == exam.id).delete()
    db.flush()

    total_marks = 0
    for link in payload.question_links:
        question = db.query(ExamQuestion).filter(ExamQuestion.id == link.question_id).first()
        if not question:
            raise HTTPException(status_code=404, detail=f"Question {link.question_id} not found")
        total_marks += link.points
        db.add(
            ExamQuestionLink(
                exam_id=exam.id,
                question_id=link.question_id,
                section_name=link.section_name,
                order_index=link.order_index,
                points=link.points,
                required=link.required,
                settings=link.settings,
            )
        )

    for faculty in payload.faculty_access:
        db.add(
            ExamFacultyAccess(
                exam_id=exam.id,
                user_id=faculty.user_id,
                can_manage=faculty.can_manage,
                can_test=faculty.can_test,
                can_review=faculty.can_review,
                can_download=faculty.can_download,
            )
        )

    student_ids = set(payload.selected_student_ids)
    student_ids.update(_eligible_students_for_departments(db, payload.selected_department_codes))
    for student_id in sorted(student_ids):
        source = "selected" if student_id in payload.selected_student_ids else "department"
        db.add(
            ExamStudentAssignment(
                exam_id=exam.id,
                student_id=student_id,
                assignment_source=source,
                is_active=True,
            )
        )

    merged_settings = dict(payload.settings)
    merged_settings["departments"] = payload.selected_department_codes
    merged_settings["selected_student_ids"] = payload.selected_student_ids
    merged_settings["question_count"] = len(payload.question_links)
    exam.settings = merged_settings
    exam.total_marks = total_marks


@router.get("/exams")
def list_exams(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    user = current_user
    exams = db.query(Exam).order_by(Exam.start_time.desc()).all()
    if not user:
        return {"items": [_serialize_exam(exam, db) for exam in exams]}
    if user.role == UserRole.student:
        visible = [exam for exam in exams if _ensure_exam_access(exam, user.id)]
        return {"items": [_serialize_exam(exam, db) for exam in visible]}
    if user.role == UserRole.faculty:
        visible = [
            exam for exam in exams if exam.created_by == user.id or any(access.user_id == user.id for access in exam.faculty_access)
        ]
        return {"items": [_serialize_exam(exam, db) for exam in visible]}
    return {"items": [_serialize_exam(exam, db) for exam in exams]}


@router.post("/exams")
def create_exam(payload: ExamPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_roles(current_user, {UserRole.faculty, UserRole.admin, UserRole.super_admin})
    if payload.status not in ExamStatus.__members__:
        raise HTTPException(status_code=400, detail="Unsupported exam status")
    if payload.access_scope not in AccessScope.__members__:
        raise HTTPException(status_code=400, detail="Unsupported access scope")
    start_time, end_time = _validate_exam_payload(payload, require_password=True)
    title_slug = _build_unique_exam_slug(db, payload.title)
    exam = Exam(
        title=payload.title,
        slug=title_slug,
        description=payload.description,
        instructions=payload.instructions,
        exam_password=hash_secret(payload.exam_password),
        start_time=start_time,
        end_time=end_time,
        duration_minutes=payload.duration_minutes,
        status=ExamStatus[payload.status],
        access_scope=AccessScope[payload.access_scope],
        shuffle_questions=payload.shuffle_questions,
        shuffle_mcq_options=payload.shuffle_mcq_options,
        allow_late_entry=payload.allow_late_entry,
        late_entry_grace_minutes=payload.late_entry_grace_minutes,
        show_score_immediately=payload.show_score_immediately,
        auto_submit_enabled=payload.auto_submit_enabled,
        created_by=current_user.id,
    )
    db.add(exam)
    db.flush()
    _sync_exam_relationships(db, exam, payload)
    _create_log(
        db,
        exam_id=exam.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="exam_created",
        details={"title": exam.title, "question_count": len(payload.question_links)},
    )
    db.commit()
    db.refresh(exam)
    return _serialize_exam(exam, db)


@router.get("/exams/{exam_id}")
def get_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if current_user.role == UserRole.student:
        if not _ensure_exam_access(exam, current_user.id):
            raise HTTPException(status_code=403, detail="Student not assigned to this exam")
        attempt = db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.student_id == current_user.id,
        ).first()
        if attempt and exam.auto_submit_enabled and datetime.utcnow() > exam.end_time and attempt.status in {AttemptStatus.not_started, AttemptStatus.in_progress}:
            _finalize_attempt_submission(
                db,
                attempt=attempt,
                actor_user_id=current_user.id,
                actor_role=current_user.role.value,
                auto_submitted=True,
            )
            db.commit()
            db.refresh(attempt)
        phase = _student_exam_phase(exam)
        review_policy = _review_policy(exam)
        review_enabled = phase == "review" and review_policy["allow_post_exam_review"]
        payload = _serialize_exam(
            exam,
            db,
            viewer="student",
            include_question_content=phase == "open" or review_enabled,
            reveal_correct_answers=review_enabled and review_policy["show_answer_key_in_review"],
        )
        payload["student_view_mode"] = phase
        payload["review_enabled"] = review_enabled
        payload["attempts"] = [
            _serialize_attempt(
                attempt,
                db,
                include_answers=review_enabled or bool(attempt and attempt.status in {AttemptStatus.submitted, AttemptStatus.auto_submitted}),
            )
        ] if attempt else []
        return payload
    _ensure_exam_review_access(current_user, exam)
    return _serialize_exam(exam, db, include_attempts=True)


@router.put("/exams/{exam_id}")
def update_exam(exam_id: int, payload: ExamPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    _ensure_exam_manage_access(current_user, exam)
    start_time, end_time = _validate_exam_payload(payload, require_password=False)
    exam.title = payload.title
    exam.slug = _build_unique_exam_slug(db, payload.title, current_exam_id=exam.id)
    exam.description = payload.description
    exam.instructions = payload.instructions
    if str(payload.exam_password or "").strip():
        exam.exam_password = hash_secret(payload.exam_password)
    exam.start_time = start_time
    exam.end_time = end_time
    exam.duration_minutes = payload.duration_minutes
    exam.status = ExamStatus[payload.status]
    exam.access_scope = AccessScope[payload.access_scope]
    exam.shuffle_questions = payload.shuffle_questions
    exam.shuffle_mcq_options = payload.shuffle_mcq_options
    exam.allow_late_entry = payload.allow_late_entry
    exam.late_entry_grace_minutes = payload.late_entry_grace_minutes
    exam.show_score_immediately = payload.show_score_immediately
    exam.auto_submit_enabled = payload.auto_submit_enabled
    _sync_exam_relationships(db, exam, payload)
    _create_log(
        db,
        exam_id=exam.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="exam_updated",
        details={"title": exam.title, "question_count": len(payload.question_links)},
    )
    db.commit()
    db.refresh(exam)
    return _serialize_exam(exam, db)


@router.post("/exams/{exam_id}/publish")
def publish_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    _ensure_exam_manage_access(current_user, exam)
    exam.status = ExamStatus.published
    exam.published_at = datetime.utcnow()
    _create_log(
        db,
        exam_id=exam.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type="exam_published",
        details={"title": exam.title},
    )
    db.commit()
    return {"success": True}


@router.post("/exams/{exam_id}/wait-room")
def enter_wait_room(exam_id: int, payload: WaitRoomPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_student_identity(current_user)
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    student = current_user
    if not exam:
        raise HTTPException(status_code=404, detail="Exam or student not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    if not _ensure_exam_access(exam, current_user.id):
        raise HTTPException(status_code=403, detail="Student not assigned to this exam")

    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id,
    ).first()
    if not attempt:
        attempt = ExamAttempt(
            exam_id=exam_id,
            student_id=current_user.id,
            status=AttemptStatus.not_started,
            waiting_room_entered_at=datetime.utcnow(),
            max_score=exam.total_marks,
        )
        db.add(attempt)
        db.flush()
    else:
        attempt.waiting_room_entered_at = datetime.utcnow()
    _create_log(
        db,
        exam_id=exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role=student.role.value,
        event_type="wait_room_entered",
        details={"timestamp": datetime.utcnow().isoformat()},
    )
    db.commit()
    db.refresh(attempt)
    return {"attempt": _serialize_attempt(attempt, db), "exam": _serialize_exam(exam, db)}


@router.post("/exams/{exam_id}/verify-password")
def verify_exam_password(exam_id: int, payload: VerifyPasswordPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_student_identity(current_user)
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    student = current_user
    if not exam:
        raise HTTPException(status_code=404, detail="Exam or student not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    if not _ensure_exam_access(exam, current_user.id):
        raise HTTPException(status_code=403, detail="Student not assigned to this exam")
    _ensure_student_exam_live(exam)
    if not verify_secret(payload.exam_password, exam.exam_password):
        raise HTTPException(status_code=401, detail="Invalid exam password")

    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id,
    ).first()
    if not attempt:
        attempt = ExamAttempt(
            exam_id=exam_id,
            student_id=current_user.id,
            status=AttemptStatus.not_started,
            max_score=exam.total_marks,
        )
        db.add(attempt)
        db.flush()
    attempt.password_verified_at = datetime.utcnow()
    _create_log(
        db,
        exam_id=exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role=student.role.value,
        event_type="exam_password_verified",
        details={"verified_at": attempt.password_verified_at.isoformat()},
    )
    db.commit()
    return {"verified": True, "attempt_id": attempt.id}


@router.post("/exams/{exam_id}/attempts/start")
def start_attempt(exam_id: int, payload: StartAttemptPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_student_identity(current_user)
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id,
    ).first()
    student = current_user
    if not exam or not attempt:
        raise HTTPException(status_code=404, detail="Exam, attempt, or student not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    if not _ensure_exam_access(exam, current_user.id):
        raise HTTPException(status_code=403, detail="Student not assigned to this exam")
    if not attempt.password_verified_at:
        raise HTTPException(status_code=400, detail="Verify exam password first")
    _ensure_exam_timing_for_start(exam, attempt)

    if attempt.status in {AttemptStatus.submitted, AttemptStatus.auto_submitted}:
        return {"attempt": _serialize_attempt(attempt, db, include_answers=True), "exam": _serialize_exam(exam, db)}

    attempt.status = AttemptStatus.in_progress
    attempt.started_at = attempt.started_at or datetime.utcnow()
    attempt.last_saved_at = datetime.utcnow()
    existing_answers = {answer.question_link_id for answer in attempt.answers}
    for link in exam.question_links:
        if link.id not in existing_answers:
            db.add(
                ExamAttemptAnswer(
                    attempt_id=attempt.id,
                    question_link_id=link.id,
                    max_score=link.points,
                )
            )
    _create_log(
        db,
        exam_id=exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role=student.role.value,
        event_type="attempt_started",
        details={"started_at": attempt.started_at.isoformat()},
    )
    db.commit()
    db.refresh(attempt)
    return {"attempt": _serialize_attempt(attempt, db, include_answers=True), "exam": _serialize_exam(exam, db)}


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    exam = db.query(Exam).filter(Exam.id == attempt.exam_id).first()
    if current_user.role == UserRole.student:
        _ensure_attempt_owner(current_user, attempt)
    else:
        _ensure_exam_review_access(current_user, exam)
    return {"attempt": _serialize_attempt(attempt, db, include_answers=True), "exam": _serialize_exam(exam, db)}


@router.post("/attempts/{attempt_id}/questions/{question_link_id}/run", response_model=JudgeResponse)
def run_exam_question(
    attempt_id: int,
    question_link_id: int,
    payload: JudgeAnswerPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    link = db.query(ExamQuestionLink).filter(ExamQuestionLink.id == question_link_id).first()
    if not attempt or not link or link.exam_id != attempt.exam_id:
        raise HTTPException(status_code=404, detail="Attempt or question not found")
    _ensure_attempt_owner(current_user, attempt)
    exam = db.query(Exam).filter(Exam.id == attempt.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    _ensure_student_exam_live(exam)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=403, detail="Attempt is not active")
    result = _judge_exam_question(link, payload, include_hidden=False)
    answer = db.query(ExamAttemptAnswer).filter(
        ExamAttemptAnswer.attempt_id == attempt.id,
        ExamAttemptAnswer.question_link_id == question_link_id,
    ).first()
    if answer:
        answer.answer_text = payload.code
        answer.draft_payload = {
            **(answer.draft_payload or {}),
            "language": payload.language,
            "custom_input": payload.custom_input,
            "last_run": result,
        }
        answer.saved_at = datetime.utcnow()
        attempt.last_saved_at = datetime.utcnow()
        db.commit()
    return JudgeResponse(**result)


@router.post("/attempts/{attempt_id}/questions/{question_link_id}/submit-solution", response_model=JudgeResponse)
def submit_exam_question(
    attempt_id: int,
    question_link_id: int,
    payload: JudgeAnswerPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    link = db.query(ExamQuestionLink).filter(ExamQuestionLink.id == question_link_id).first()
    if not attempt or not link or link.exam_id != attempt.exam_id:
        raise HTTPException(status_code=404, detail="Attempt or question not found")
    _ensure_attempt_owner(current_user, attempt)
    exam = db.query(Exam).filter(Exam.id == attempt.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    _ensure_student_exam_live(exam)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=403, detail="Attempt is not active")
    result = _judge_exam_question(link, payload, include_hidden=True)
    answer = db.query(ExamAttemptAnswer).filter(
        ExamAttemptAnswer.attempt_id == attempt.id,
        ExamAttemptAnswer.question_link_id == question_link_id,
    ).first()
    if not answer:
        answer = ExamAttemptAnswer(attempt_id=attempt.id, question_link_id=question_link_id, max_score=link.points)
        db.add(answer)
        db.flush()
    answer.answer_text = payload.code
    answer.score = result["score"]
    answer.max_score = result["max_score"]
    answer.draft_payload = {
        **(answer.draft_payload or {}),
        "language": payload.language,
        "custom_input": payload.custom_input,
        "last_run": result,
        "last_submission": result,
        "score": result["score"],
        "visible_passed": result["visible_passed"],
        "visible_total": result["visible_total"],
        "hidden_passed": result["hidden_passed"],
        "hidden_total": result["hidden_total"],
        "execution_time_ms": result["execution_time_ms"],
        "test_case_results": result["test_case_results"],
    }
    answer.saved_at = datetime.utcnow()
    attempt.last_saved_at = datetime.utcnow()
    _create_log(
        db,
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role="student",
        event_type="question_submitted",
        details={"question_link_id": question_link_id, "score": result["score"], "language": payload.language},
    )
    db.commit()
    return JudgeResponse(**result)


@router.put("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: int, payload: SaveAnswerPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    _ensure_attempt_owner(current_user, attempt)
    exam = db.query(Exam).filter(Exam.id == attempt.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    _ensure_student_exam_live(exam)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=403, detail="Attempt is not active")

    answer_map = {answer.question_link_id: answer for answer in attempt.answers}
    for answer_payload in payload.answers:
        question_link_id = answer_payload.get("question_link_id")
        if not question_link_id:
            continue
        answer = answer_map.get(question_link_id)
        if not answer:
            answer = ExamAttemptAnswer(
                attempt_id=attempt.id,
                question_link_id=question_link_id,
                max_score=answer_payload.get("max_score", 0),
            )
            db.add(answer)
            db.flush()
            answer_map[question_link_id] = answer

        answer.answer_text = answer_payload.get("answer_text", "")
        answer.selected_options = answer_payload.get("selected_options", [])
        answer.draft_payload = answer_payload.get("draft_payload", {})
        answer.saved_at = datetime.utcnow()
        question_link = db.query(ExamQuestionLink).filter(ExamQuestionLink.id == question_link_id).first()
        if question_link and question_link.question.question_type == QuestionKind.mcq:
            expected = sorted(question_link.question.correct_answers or [])
            selected = sorted(answer.selected_options or [])
            answer.is_correct = expected == selected
            answer.score = question_link.points if answer.is_correct else 0
            answer.max_score = question_link.points

    attempt.last_saved_at = datetime.utcnow()
    _create_log(
        db,
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role="student",
        event_type="answers_saved",
        details={"answer_count": len(payload.answers)},
    )
    db.commit()
    db.refresh(attempt)
    return {"attempt": _serialize_attempt(attempt, db, include_answers=True)}


@router.post("/attempts/{attempt_id}/submit")
def submit_attempt(attempt_id: int, payload: SubmitAttemptPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    _ensure_attempt_owner(current_user, attempt)
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")

    _finalize_attempt_submission(
        db,
        attempt=attempt,
        actor_user_id=current_user.id,
        actor_role="student",
        auto_submitted=payload.auto_submitted,
    )
    db.commit()
    db.refresh(attempt)
    return {"attempt": _serialize_attempt(attempt, db, include_answers=True)}


@router.post("/attempts/{attempt_id}/events")
def record_attempt_event(attempt_id: int, payload: EventPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    _ensure_attempt_owner(current_user, attempt)
    _create_log(
        db,
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role=current_user.role.value,
        event_type=payload.event_type,
        details=payload.details,
    )
    db.commit()
    return {"success": True}


@router.post("/attempts/{attempt_id}/snapshots")
def create_snapshot(attempt_id: int, payload: SnapshotPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _cleanup_expired_snapshots(db)
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    _ensure_attempt_owner(current_user, attempt)
    if payload.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Student mismatch")
    snapshot = ExamProctorSnapshot(
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        student_id=current_user.id,
        image_data=payload.image_data,
        mime_type=payload.mime_type,
        captured_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7),
        trigger_type=payload.trigger_type,
        face_status=payload.face_status,
        details=payload.details,
    )
    db.add(snapshot)
    _create_log(
        db,
        exam_id=attempt.exam_id,
        attempt_id=attempt.id,
        actor_user_id=current_user.id,
        actor_role="student",
        event_type="snapshot_captured",
        details={"trigger_type": payload.trigger_type, "face_status": payload.face_status},
    )
    db.commit()
    db.refresh(snapshot)
    return {
        "id": snapshot.id,
        "captured_at": snapshot.captured_at.isoformat(),
        "expires_at": snapshot.expires_at.isoformat(),
    }


@router.get("/exams/{exam_id}/snapshots")
def list_exam_snapshots(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _cleanup_expired_snapshots(db)
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    _ensure_exam_review_access(current_user, exam)
    snapshots = db.query(ExamProctorSnapshot).filter(ExamProctorSnapshot.exam_id == exam_id).order_by(ExamProctorSnapshot.captured_at.desc()).all()
    return {
        "items": [
            {
                "id": shot.id,
                "attempt_id": shot.attempt_id,
                "student_id": shot.student_id,
                "student": _user_brief(student, _get_profile(db, shot.student_id)) if (student := _get_user(db, shot.student_id)) else None,
                "image_data": shot.image_data,
                "mime_type": shot.mime_type,
                "captured_at": shot.captured_at.isoformat(),
                "expires_at": shot.expires_at.isoformat(),
                "trigger_type": shot.trigger_type,
                "face_status": shot.face_status,
                "details": shot.details or {},
            }
            for shot in snapshots
        ]
    }


@router.get("/exams/{exam_id}/results")
def exam_results(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    _ensure_exam_review_access(current_user, exam)
    items = []
    for attempt in exam.attempts:
        answer_breakdown = []
        for answer in attempt.answers:
            question_link = answer.question_link
            answer_breakdown.append(
                {
                    "question_link_id": question_link.id,
                    "question_title": question_link.question.title,
                    "question_type": question_link.question.question_type.value,
                    "score": answer.score,
                    "max_score": answer.max_score or question_link.points,
                    "answer_text": answer.answer_text or "",
                    "selected_options": answer.selected_options or [],
                    "draft_payload": answer.draft_payload or {},
                    "is_correct": answer.is_correct,
                }
            )
        items.append({**_serialize_attempt(attempt, db), "answer_breakdown": answer_breakdown})
    scores = [item["score"] for item in items]
    return {
        "exam": _serialize_exam(exam, db),
        "summary": {
            "attempt_count": len(items),
            "submitted_count": len([item for item in items if item["status"] in {"submitted", "auto_submitted"}]),
            "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "highest_score": max(scores) if scores else 0,
            "snapshot_count": db.query(ExamProctorSnapshot).filter(ExamProctorSnapshot.exam_id == exam_id).count(),
        },
        "items": items,
    }


@router.get("/exams/{exam_id}/logs")
def exam_logs(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    _ensure_exam_review_access(current_user, exam)
    logs = db.query(ExamActivityLog).filter(ExamActivityLog.exam_id == exam_id).order_by(ExamActivityLog.created_at.desc()).all()
    return {
        "items": [
            {
                "id": log.id,
                "attempt_id": log.attempt_id,
                "actor_user_id": log.actor_user_id,
                "actor_role": log.actor_role,
                "actor_name": actor.name if (actor := _get_user(db, log.actor_user_id)) else None,
                "event_type": log.event_type,
                "details": log.details or {},
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }
