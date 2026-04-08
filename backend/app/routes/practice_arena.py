import ast
import contextlib
import inspect
import io
import re
import sqlite3
import sys
import time
import traceback
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slugify import slugify

from app.db import get_db
from app.models.practice_arena import (
    Question,
    Example,
    TestCase,
    StarterCode,
    Solution,
    DifficultyLevel,
    QuestionCategory,
    QuestionVisibility,
    ApproachType,
    ProgrammingLanguage,
)


router = APIRouter(prefix="/questions", tags=["questions"])


# ======================== PYDANTIC SCHEMAS ========================


class ExampleCreate(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None


class ExampleResponse(BaseModel):
    id: int
    input: str
    output: str
    explanation: Optional[str]

    class Config:
        from_attributes = True


class TestCaseCreate(BaseModel):
    input: str
    output: str
    is_hidden: bool = False


class TestCaseResponse(BaseModel):
    id: int
    input: str
    output: str
    is_hidden: bool

    class Config:
        from_attributes = True


class TestCaseUpdate(BaseModel):
    input: Optional[str] = None
    output: Optional[str] = None
    is_hidden: Optional[bool] = None


class StarterCodeCreate(BaseModel):
    language: str
    code: str


class StarterCodeResponse(BaseModel):
    id: int
    language: str
    code: str

    class Config:
        from_attributes = True


class SolutionCreate(BaseModel):
    language: str = "python"
    code: str
    explanation: str
    approach_type: str = "optimized"


class SolutionResponse(BaseModel):
    id: int
    language: str
    code: str
    explanation: str
    approach_type: str

    class Config:
        from_attributes = True


class SampleTableCreate(BaseModel):
    name: str
    columns: List[str]
    rows: List[List[str]] = []


class SampleTableResponse(BaseModel):
    name: str
    columns: List[str]
    rows: List[List[str]]


class QuestionCreate(BaseModel):
    title: str
    difficulty: str
    category: str
    tags: List[str] = []
    problem_statement: str
    short_description: Optional[str] = None
    diagram_url: Optional[str] = None
    diagram_caption: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    sql_schema: Optional[str] = None
    expected_output: Optional[str] = None
    sample_tables: List[SampleTableCreate] = []
    function_signature: Optional[str] = None
    constraints: Optional[str] = None
    time_limit: int = 1
    memory_limit: int = 256
    points: int = 10
    visibility: str = "draft"
    examples: List[ExampleCreate] = []
    test_cases: List[TestCaseCreate] = []
    starter_codes: List[StarterCodeCreate] = []
    solutions: List[SolutionCreate] = []


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    difficulty: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    problem_statement: Optional[str] = None
    short_description: Optional[str] = None
    diagram_url: Optional[str] = None
    diagram_caption: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    sql_schema: Optional[str] = None
    expected_output: Optional[str] = None
    sample_tables: Optional[List[SampleTableCreate]] = None
    function_signature: Optional[str] = None
    constraints: Optional[str] = None
    time_limit: Optional[int] = None
    memory_limit: Optional[int] = None
    points: Optional[int] = None
    visibility: Optional[str] = None
    examples: Optional[List[ExampleCreate]] = None
    test_cases: Optional[List[TestCaseCreate]] = None
    starter_codes: Optional[List[StarterCodeCreate]] = None
    solutions: Optional[List[SolutionCreate]] = None


class QuestionSummaryResponse(BaseModel):
    id: int
    title: str
    difficulty: str
    category: str
    tags: List[str]
    short_description: Optional[str] = None
    points: int
    visibility: str

    class Config:
        from_attributes = True


class QuestionDetailResponse(BaseModel):
    id: int
    title: str
    slug: str
    difficulty: str
    category: str
    tags: List[str]
    problem_statement: str
    short_description: Optional[str]
    diagram_url: Optional[str]
    diagram_caption: Optional[str]
    input_format: Optional[str]
    output_format: Optional[str]
    sql_schema: Optional[str]
    expected_output: Optional[str]
    sample_tables: List[SampleTableResponse] = []
    function_signature: Optional[str]
    constraints: Optional[str]
    time_limit: int
    memory_limit: int
    points: int
    visibility: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    examples: List[ExampleResponse]
    test_cases: List[TestCaseResponse]
    starter_codes: List[StarterCodeResponse]
    solutions: List[SolutionResponse]

    class Config:
        from_attributes = True


class TestCaseResult(BaseModel):
    id: int
    actual_output: str
    expected_output: str
    passed: bool
    is_hidden: bool

    class Config:
        from_attributes = True


class RunCodeRequest(BaseModel):
    code: str
    language: str
    input: Optional[str] = ""
    question_id: Optional[int] = None
    question_slug: Optional[str] = None
    question_title: Optional[str] = None


class RunCodeResponse(BaseModel):
    output: str
    status: str
    errors: Optional[str] = None
    execution_time_ms: float
    visible_total: int = 0
    visible_passed: int = 0
    hidden_total: int = 0
    hidden_passed: int = 0
    test_case_results: List[TestCaseResult] = []

    class Config:
        from_attributes = True


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

    if "=" in text:
        exec_locals: dict[str, object] = {}
        try:
            exec(text, {}, exec_locals)
            for key, value in exec_locals.items():
                if key.startswith("__"):
                    continue
                kwargs.setdefault(key, value)
        except Exception:
            pass

    return args, kwargs


def _can_call_without_args(func) -> bool:
    try:
        signature = inspect.signature(func)
    except (ValueError, TypeError):
        return False
    for param in signature.parameters.values():
        if (
            param.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
            and param.default is inspect._empty
        ):
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


def _normalize_sql(query: Optional[str]) -> str:
    normalized = " ".join((query or "").strip().lower().split())
    return normalized.rstrip(";")


def _normalize_result_text(value: Optional[str]) -> str:
    return "\n".join(
        line.strip()
        for line in io.StringIO(value or "").getvalue().splitlines()
        if line.strip()
    )


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

    aliases = {str(name).lower()}
    if str(name).endswith("s"):
        aliases.add(str(name)[:-1].lower())
    else:
        aliases.add(f"{str(name).lower()}s")
        if str(name).lower().endswith("y"):
            aliases.add(f"{str(name).lower()[:-1]}ies")
    if str(name).lower().endswith("ee"):
        aliases.add(f"{str(name).lower()}s")

    for alias in aliases:
        if not alias or alias == str(name).lower():
            continue
        try:
            cursor.execute(f'DROP VIEW IF EXISTS "{alias}"')
            cursor.execute(f'CREATE VIEW "{alias}" AS SELECT * FROM "{name}"')
        except Exception:
            pass


def _resolve_question(payload: "RunCodeRequest", db: Session) -> Optional[Question]:
    question = None
    if payload.question_id:
        question = db.query(Question).filter(Question.id == payload.question_id).first()
    if question is None and payload.question_slug:
        question = db.query(Question).filter(Question.slug == payload.question_slug).first()
    if question is None and payload.question_title:
        question = db.query(Question).filter(Question.title == payload.question_title).first()
    return question


def _format_sql_rows(cursor, rows):
    if cursor.description:
        headers = [column[0] for column in cursor.description]
        lines = [" | ".join(headers)]
        lines.extend(" | ".join("" if cell is None else str(cell) for cell in row) for row in rows)
        return "\n".join(lines)
    return "Query executed successfully."


def _run_sql_query(code: str, question: Optional[Question]):
    start = time.perf_counter()
    if not question or not question.sample_tables:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", "Sample tables are not available for this SQL question yet.", runtime, "error"

    connection = sqlite3.connect(":memory:")
    connection.create_function("DATEDIFF", 2, _sqlite_datediff)
    connection.create_function("DATE_FORMAT", 2, _sqlite_date_format)
    connection.create_function("DATE_SUB", 3, _sqlite_date_sub)
    cursor = connection.cursor()
    try:
        for table in question.sample_tables or []:
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
        output = (
            _format_sql_rows(cursor, rows)
            if cursor.description
            else f"Query executed successfully. Rows affected: {cursor.rowcount if cursor.rowcount != -1 else 0}"
        )
        runtime = (time.perf_counter() - start) * 1000
        return output, None, runtime, "success"
    except Exception as exc:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", str(exc), runtime, "error"
    finally:
        connection.close()


def _evaluate_sql(payload: RunCodeRequest, question: Optional[Question], include_test_results: bool):
    submitted = _normalize_sql(payload.code)
    expected_output = (
        question.expected_output.strip()
        if question and question.expected_output
        else "Expected result preview is not available for this SQL problem yet."
    )
    sql_solutions = [
        solution for solution in (question.solutions if question else []) if solution.language == ProgrammingLanguage.sql
    ]

    if not submitted:
        return {
            "output": "(no output)\n",
            "status": "error",
            "errors": "Write an SQL query before running or submitting.",
            "execution_time_ms": 0.0,
            "visible_total": 0,
            "visible_passed": 0,
            "hidden_total": 0,
            "hidden_passed": 0,
            "test_case_results": [],
        }

    output, errors, execution_time_ms, status = _run_sql_query(payload.code, question)

    if not include_test_results:
        return {
            "output": output,
            "status": status,
            "errors": errors,
            "execution_time_ms": execution_time_ms,
            "visible_total": 0,
            "visible_passed": 0,
            "hidden_total": 0,
            "hidden_passed": 0,
            "test_case_results": [],
        }

    normalized_output = _normalize_result_text(output)
    normalized_expected = _normalize_result_text(expected_output)
    passed = status == "success" and normalized_output == normalized_expected
    error_message = None
    if not passed:
        error_message = errors or "Query result did not match the expected output. Check joins, grouping, aliases, and ordering."

    return {
        "output": output,
        "status": "success" if passed else "error",
        "errors": error_message,
        "execution_time_ms": execution_time_ms,
        "visible_total": 1,
        "visible_passed": 1 if passed else 0,
        "hidden_total": max(len(sql_solutions) - 1, 0),
        "hidden_passed": max(len(sql_solutions) - 1, 0) if passed else 0,
        "test_case_results": [
            TestCaseResult(
                id=1,
                actual_output=output if status == "success" else "No matching result",
                expected_output=expected_output,
                passed=passed,
                is_hidden=False,
            ).dict()
        ],
    }


def _evaluate_code(payload: RunCodeRequest, db: Session):
    test_case_results: List[TestCaseResult] = []
    visible_total = visible_passed = hidden_total = hidden_passed = 0
    status = "success"
    execution_time_ms = 0.0
    errors = None
    output = None

    question = None
    if payload.question_id:
        question = db.query(Question).filter(Question.id == payload.question_id).first()

    if payload.language == "python":
        output, errors, execution_time_ms, status = _run_python_code(payload.code, payload.input)
        if question:
            for test_case in question.test_cases:
                tc_output, tc_errors, _, tc_status = _run_python_code(payload.code, test_case.input)
                actual = (tc_output or "").strip()
                expected = (test_case.output or "").strip()
                passed = tc_status == "success" and not tc_errors and actual == expected
                if test_case.is_hidden:
                    hidden_total += 1
                    if passed:
                        hidden_passed += 1
                else:
                    visible_total += 1
                    if passed:
                        visible_passed += 1
                test_case_results.append(
                    TestCaseResult(
                        id=test_case.id,
                        actual_output=actual,
                        expected_output=expected,
                        passed=passed,
                        is_hidden=test_case.is_hidden,
                    )
                )
    elif payload.language == "sql":
        return _evaluate_sql(payload, question, include_test_results=payload.input != "__RUN_ONLY__")
    else:
        status = "success"
        execution_time_ms = 0.0
        errors = None
        output = (
            payload.code
            if payload.code
            else f"[{payload.language}] Execution simulated. Actual sandbox not available."
        )

    if not output:
        output = "(no output)\n"

    return {
        "output": output,
        "status": status,
        "errors": errors,
        "execution_time_ms": execution_time_ms,
        "visible_total": visible_total,
        "visible_passed": visible_passed,
        "hidden_total": hidden_total,
        "hidden_passed": hidden_passed,
        "test_case_results": [result.dict() for result in test_case_results],
    }


# ======================== API ROUTES ========================


@router.post("/create", response_model=QuestionDetailResponse)
def create_question(
    question: QuestionCreate,
    created_by: int = 1,
    db: Session = Depends(get_db),
):
    try:
        slug = slugify(question.title)
        existing = db.query(Question).filter(Question.slug == slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Question with this title already exists")

        db_question = Question(
            title=question.title,
            slug=slug,
            difficulty=DifficultyLevel[question.difficulty],
            category=QuestionCategory[question.category],
            tags=question.tags,
            problem_statement=question.problem_statement,
            short_description=question.short_description,
            diagram_url=question.diagram_url,
            diagram_caption=question.diagram_caption,
            input_format=question.input_format,
            output_format=question.output_format,
            sql_schema=question.sql_schema,
            expected_output=question.expected_output,
            sample_tables=question.sample_tables,
            function_signature=question.function_signature,
            constraints=question.constraints,
            time_limit=question.time_limit,
            memory_limit=question.memory_limit,
            points=question.points,
            visibility=QuestionVisibility[question.visibility],
            created_by=created_by,
        )

        db.add(db_question)
        db.flush()

        for example in question.examples:
            db_example = Example(
                question_id=db_question.id,
                input=example.input,
                output=example.output,
                explanation=example.explanation,
            )
            db.add(db_example)

        for test_case in question.test_cases:
            db_test_case = TestCase(
                question_id=db_question.id,
                input=test_case.input,
                output=test_case.output,
                is_hidden=test_case.is_hidden,
            )
            db.add(db_test_case)

        for starter_code in question.starter_codes:
            db_starter = StarterCode(
                question_id=db_question.id,
                language=ProgrammingLanguage[starter_code.language],
                code=starter_code.code,
            )
            db.add(db_starter)

        for solution in question.solutions:
            db_solution = Solution(
                question_id=db_question.id,
                language=ProgrammingLanguage[solution.language],
                code=solution.code,
                explanation=solution.explanation,
                approach_type=ApproachType[solution.approach_type],
            )
            db.add(db_solution)

        db.commit()
        db.refresh(db_question)

        return db_question
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/", response_model=List[QuestionSummaryResponse])
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Question).filter(Question.visibility == QuestionVisibility.published)
    if category:
        query = query.filter(Question.category == QuestionCategory[category])
    if difficulty:
        query = query.filter(Question.difficulty == DifficultyLevel[difficulty])
    if tags:
        query = query.filter(Question.tags.contains(tags))
    if search:
        query = query.filter(Question.title.ilike(f"%{search}%"))

    questions = query.order_by(Question.created_at.desc()).offset(skip).limit(limit).all()
    return questions


@router.get("/manage/all", response_model=List[QuestionSummaryResponse])
def list_all_questions_for_management(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Question)
    if search:
        query = query.filter(Question.title.ilike(f"%{search}%"))
    return query.order_by(Question.updated_at.desc()).offset(skip).limit(limit).all()


@router.get("/{question_id}", response_model=QuestionDetailResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question or question.visibility != QuestionVisibility.published:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.get("/manage/{question_id}", response_model=QuestionDetailResponse)
def get_question_for_management(question_id: int, db: Session = Depends(get_db)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/run-code", response_model=RunCodeResponse)
def run_code(payload: RunCodeRequest, db: Session = Depends(get_db)):
    if payload.language == "sql":
        payload = RunCodeRequest(
            code=payload.code,
            language=payload.language,
            input="__RUN_ONLY__",
            question_id=payload.question_id,
            question_slug=payload.question_slug,
            question_title=payload.question_title,
        )
    return RunCodeResponse(**_evaluate_code(payload, db))


@router.post("/submit", response_model=RunCodeResponse)
def submit_code(payload: RunCodeRequest, db: Session = Depends(get_db)):
    return RunCodeResponse(**_evaluate_code(payload, db))


@router.put("/{question_id}", response_model=QuestionDetailResponse)
def update_question(
    question_id: int,
    question_update: QuestionUpdate,
    db: Session = Depends(get_db),
):
    db_question = db.query(Question).filter(Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    update_data = question_update.dict(exclude_unset=True)
    if "difficulty" in update_data:
        update_data["difficulty"] = DifficultyLevel[update_data["difficulty"]]
    if "category" in update_data:
        update_data["category"] = QuestionCategory[update_data["category"]]
    if "visibility" in update_data:
        update_data["visibility"] = QuestionVisibility[update_data["visibility"]]
    if "title" in update_data:
        update_data["slug"] = slugify(update_data["title"])

    nested_examples = update_data.pop("examples", None)
    nested_test_cases = update_data.pop("test_cases", None)
    nested_starter_codes = update_data.pop("starter_codes", None)
    nested_solutions = update_data.pop("solutions", None)

    update_data["updated_at"] = datetime.utcnow()
    for field, value in update_data.items():
        setattr(db_question, field, value)

    if nested_examples is not None:
        db.query(Example).filter(Example.question_id == db_question.id).delete()
        for example in nested_examples:
            db.add(
                Example(
                    question_id=db_question.id,
                    input=example.input,
                    output=example.output,
                    explanation=example.explanation,
                )
            )

    if nested_test_cases is not None:
        db.query(TestCase).filter(TestCase.question_id == db_question.id).delete()
        for test_case in nested_test_cases:
            db.add(
                TestCase(
                    question_id=db_question.id,
                    input=test_case.input,
                    output=test_case.output,
                    is_hidden=test_case.is_hidden,
                )
            )

    if nested_starter_codes is not None:
        db.query(StarterCode).filter(StarterCode.question_id == db_question.id).delete()
        for starter_code in nested_starter_codes:
            db.add(
                StarterCode(
                    question_id=db_question.id,
                    language=ProgrammingLanguage[starter_code.language],
                    code=starter_code.code,
                )
            )

    if nested_solutions is not None:
        db.query(Solution).filter(Solution.question_id == db_question.id).delete()
        for solution in nested_solutions:
            db.add(
                Solution(
                    question_id=db_question.id,
                    language=ProgrammingLanguage[solution.language],
                    code=solution.code,
                    explanation=solution.explanation,
                    approach_type=ApproachType[solution.approach_type],
                )
            )

    db.commit()
    db.refresh(db_question)
    return db_question


@router.delete("/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    db_question = db.query(Question).filter(Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(db_question)
    db.commit()

    return {"message": "Question deleted successfully"}


@router.post("/{question_id}/examples", response_model=ExampleResponse)
def add_example(
    question_id: int,
    example: ExampleCreate,
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db_example = Example(
        question_id=question_id,
        input=example.input,
        output=example.output,
        explanation=example.explanation,
    )

    db.add(db_example)
    db.commit()
    db.refresh(db_example)

    return db_example


@router.post("/{question_id}/testcases", response_model=TestCaseResponse)
def add_test_case(
    question_id: int,
    test_case: TestCaseCreate,
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db_test_case = TestCase(
        question_id=question_id,
        input=test_case.input,
        output=test_case.output,
        is_hidden=test_case.is_hidden,
    )

    db.add(db_test_case)
    db.commit()
    db.refresh(db_test_case)

    return db_test_case


@router.put("/testcases/{test_case_id}", response_model=TestCaseResponse)
def update_test_case(
    test_case_id: int,
    update: TestCaseUpdate,
    db: Session = Depends(get_db),
):
    test_case = db.query(TestCase).filter(TestCase.id == test_case_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    if update.input is not None:
        test_case.input = update.input
    if update.output is not None:
        test_case.output = update.output
    if update.is_hidden is not None:
        test_case.is_hidden = update.is_hidden

    db.commit()
    db.refresh(test_case)
    return test_case


@router.post("/{question_id}/starter-code", response_model=StarterCodeResponse)
def add_starter_code(
    question_id: int,
    starter_code: StarterCodeCreate,
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db_starter = StarterCode(
        question_id=question_id,
        language=ProgrammingLanguage[starter_code.language],
        code=starter_code.code,
    )

    db.add(db_starter)
    db.commit()
    db.refresh(db_starter)

    return db_starter
