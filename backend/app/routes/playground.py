import asyncio
import json
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import PlaygroundSave


router = APIRouter(prefix="/playground", tags=["playground"])


SUPPORTED_LANGUAGES = {"python", "javascript"}
PYTHON_MODULES = [
    "pandas",
    "numpy",
    "openpyxl",
    "matplotlib",
    "seaborn",
    "plotly",
    "dash",
    "dash-bootstrap-components",
    "streamlit",
    "scipy",
    "scikit-learn",
    "statsmodels",
    "pyarrow",
    "xlrd",
]
STREAMLIT_SESSION = {"process": None, "port": None, "temp_dir": None, "script_path": None, "started_at": None}


class PlaygroundRunRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""


class PlaygroundRunResponse(BaseModel):
    output: str
    errors: Optional[str] = None
    status: str
    execution_time_ms: float
    language: str


class StreamlitSessionResponse(BaseModel):
    status: str
    url: Optional[str] = None
    port: Optional[int] = None
    message: Optional[str] = None
    started_at: Optional[float] = None


class PlaygroundSavePayload(BaseModel):
    user_id: int
    module: str
    name: str
    language: str = "python"
    code: str


class PlaygroundSaveResponse(BaseModel):
    id: int
    user_id: int
    module: str
    name: str
    language: str
    code: str
    updated_at: Optional[float] = None


def _serialize_save(save: PlaygroundSave) -> PlaygroundSaveResponse:
    return PlaygroundSaveResponse(
        id=save.id,
        user_id=save.user_id,
        module=save.module,
        name=save.name,
        language=save.language,
        code=save.code,
        updated_at=save.updated_at.timestamp() if save.updated_at else None,
    )


def _get_db() -> Session:
    return SessionLocal()


def _cleanup_temp_dir(temp_dir: Path) -> None:
    shutil.rmtree(temp_dir, ignore_errors=True)


def _write_uploaded_files(temp_dir: Path, files: list[UploadFile]) -> list[str]:
    uploaded_names: list[str] = []
    for upload in files:
        safe_name = Path(upload.filename or "upload.bin").name
        target = temp_dir / safe_name
        target.write_bytes(upload.file.read())
        uploaded_names.append(safe_name)
    return uploaded_names


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _stop_streamlit_session() -> None:
    process = STREAMLIT_SESSION.get("process")
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            process.kill()
    temp_dir = STREAMLIT_SESSION.get("temp_dir")
    if temp_dir:
        _cleanup_temp_dir(Path(temp_dir))
    STREAMLIT_SESSION.update({"process": None, "port": None, "temp_dir": None, "script_path": None, "started_at": None})


def _run_process(command: list[str], script_path: Path, stdin: str, timeout_seconds: int = 12):
    start = time.perf_counter()
    try:
        completed = subprocess.run(
            command + [str(script_path)],
            input=stdin or "",
            text=True,
            capture_output=True,
            cwd=str(script_path.parent),
            timeout=timeout_seconds,
            check=False,
        )
        runtime = (time.perf_counter() - start) * 1000
        output = completed.stdout or "(no output)\n"
        errors = completed.stderr.strip() or None
        if errors and "EOFError: EOF when reading a line" in errors:
            guidance = (
                "Your program is waiting for input(). In Python live terminal mode, type into the terminal input bar and press Enter.\n"
                "Example for two input() calls:\n"
                "Yogir\n"
                "25"
            )
            errors = f"{errors}\n\n{guidance}"
        status = "success" if completed.returncode == 0 and not errors else "error"
        return output, errors, runtime, status
    except subprocess.TimeoutExpired:
        runtime = (time.perf_counter() - start) * 1000
        return "(no output)\n", f"Execution timed out after {timeout_seconds} seconds.", runtime, "error"


def _run_python(code: str, stdin: str, uploaded_files: Optional[list[UploadFile]] = None):
    normalized = str(code or "").lower()
    if "import streamlit" in normalized or "from streamlit" in normalized:
        return (
            "(no output)\n",
            "Streamlit apps do not run inside Compiler Lab because they need a live web server and browser session. "
            "Use the dedicated App Playground tab for Streamlit apps.",
            0,
            "error",
        )

    temp_dir = Path(tempfile.mkdtemp(prefix="playground-py-"))
    script_path = temp_dir / "main.py"
    uploaded_names = _write_uploaded_files(temp_dir, uploaded_files or [])
    bootstrap = [
        "import os",
        "import sys",
        "os.chdir(os.path.dirname(__file__))",
        f"print('Uploaded files:', {uploaded_names})" if uploaded_names else "",
        code or "",
    ]
    script_path.write_text("\n".join([line for line in bootstrap if line]), encoding="utf-8")
    try:
        return _run_process(["python"], script_path, stdin)
    finally:
        _cleanup_temp_dir(temp_dir)


def _run_javascript(code: str, stdin: str, uploaded_files: Optional[list[UploadFile]] = None):
    temp_dir = Path(tempfile.mkdtemp(prefix="playground-js-"))
    script_path = temp_dir / "main.js"
    uploaded_names = _write_uploaded_files(temp_dir, uploaded_files or [])
    bootstrap = [
        "process.chdir(__dirname);",
        f"console.log('Uploaded files:', {uploaded_names});" if uploaded_names else "",
        code or "",
    ]
    script_path.write_text("\n".join([line for line in bootstrap if line]), encoding="utf-8")
    try:
        return _run_process(["node"], script_path, stdin)
    finally:
        _cleanup_temp_dir(temp_dir)


def _build_response(language: str, output: str, errors: Optional[str], runtime: float, status: str):
    return PlaygroundRunResponse(
        output=output,
        errors=errors,
        status=status,
        execution_time_ms=runtime,
        language=language,
    )


def _unsupported_language_response(language: str):
    supported = ", ".join(sorted(SUPPORTED_LANGUAGES))
    return PlaygroundRunResponse(
        output="(no output)\n",
        errors=f"{language or 'Selected language'} is not available on this machine yet. Current runnable languages: {supported}.",
        status="error",
        execution_time_ms=0,
        language=language or "unknown",
    )


def _build_streamlit_session(code: str, files: list[UploadFile]):
    _stop_streamlit_session()
    temp_dir = Path(tempfile.mkdtemp(prefix="playground-streamlit-"))
    uploaded_names = _write_uploaded_files(temp_dir, files or [])
    script_path = temp_dir / "app.py"
    bootstrap = [
        "import os",
        "os.chdir(os.path.dirname(__file__))",
        code or "",
    ]
    script_path.write_text("\n".join([line for line in bootstrap if line]), encoding="utf-8")
    port = _find_free_port()
    process = subprocess.Popen(
        [
            "python",
            "-m",
            "streamlit",
            "run",
            str(script_path),
            "--server.headless",
            "true",
            "--server.port",
            str(port),
            "--browser.gatherUsageStats",
            "false",
        ],
        cwd=str(temp_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    STREAMLIT_SESSION.update(
        {
            "process": process,
            "port": port,
            "temp_dir": str(temp_dir),
            "script_path": str(script_path),
            "started_at": time.time(),
            "uploaded_files": uploaded_names,
        }
    )
    return port


async def _stream_terminal_output(stream: asyncio.StreamReader, websocket: WebSocket, channel: str) -> None:
    while True:
        chunk = await stream.read(1)
        if not chunk:
            break
        await websocket.send_text(
            json.dumps(
                {
                    "type": "output",
                    "channel": channel,
                    "data": chunk.decode("utf-8", errors="replace"),
                }
            )
        )


@router.websocket("/python-terminal")
async def python_terminal_session(websocket: WebSocket):
    await websocket.accept()
    temp_dir: Optional[Path] = None
    process: Optional[asyncio.subprocess.Process] = None
    stdout_task: Optional[asyncio.Task] = None
    stderr_task: Optional[asyncio.Task] = None
    try:
        initial_message = await websocket.receive_json()
        code = str(initial_message.get("code") or "")
        normalized = code.lower()
        if "import streamlit" in normalized or "from streamlit" in normalized:
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "error",
                        "message": "Streamlit apps do not run inside Compiler Lab. Use App Playground for Streamlit apps.",
                    }
                )
            )
            await websocket.close()
            return

        temp_dir = Path(tempfile.mkdtemp(prefix="playground-term-py-"))
        script_path = temp_dir / "main.py"
        bootstrap = [
            "import os",
            "os.chdir(os.path.dirname(__file__))",
            code,
        ]
        script_path.write_text("\n".join([line for line in bootstrap if line]), encoding="utf-8")

        process = await asyncio.create_subprocess_exec(
            "python",
            "-u",
            str(script_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(temp_dir),
        )

        stdout_task = asyncio.create_task(_stream_terminal_output(process.stdout, websocket, "stdout"))
        stderr_task = asyncio.create_task(_stream_terminal_output(process.stderr, websocket, "stderr"))
        exit_task = asyncio.create_task(process.wait())

        await websocket.send_text(json.dumps({"type": "status", "status": "running"}))

        while True:
            receive_task = asyncio.create_task(websocket.receive_json())
            done, pending = await asyncio.wait({receive_task, exit_task}, return_when=asyncio.FIRST_COMPLETED)

            if exit_task in done:
                receive_task.cancel()
                break

            message = receive_task.result()
            for task in pending:
                task.cancel()

            msg_type = message.get("type")
            if msg_type == "input" and process.stdin:
                value = str(message.get("data") or "")
                process.stdin.write((value + "\n").encode("utf-8"))
                await process.stdin.drain()
            elif msg_type == "terminate":
                process.terminate()
                break

        return_code = await process.wait()
        if stdout_task:
            await stdout_task
        if stderr_task:
            await stderr_task
        await websocket.send_text(json.dumps({"type": "exit", "returncode": return_code}))
    except WebSocketDisconnect:
        if process and process.returncode is None:
            process.terminate()
    finally:
        if stdout_task and not stdout_task.done():
            stdout_task.cancel()
        if stderr_task and not stderr_task.done():
            stderr_task.cancel()
        if process and process.returncode is None:
            process.terminate()
        if temp_dir:
            _cleanup_temp_dir(temp_dir)


@router.get("/capabilities")
def get_playground_capabilities():
    return {
        "supported_languages": sorted(SUPPORTED_LANGUAGES),
        "python_modules": PYTHON_MODULES,
        "uploads_supported": True,
        "streamlit_supported": True,
        "coming_soon": ["java", "cpp", "sql_playground", "notebook_lab"],
    }


@router.get("/saves", response_model=list[PlaygroundSaveResponse])
def list_playground_saves(user_id: int, module: Optional[str] = None):
    db = _get_db()
    try:
        query = db.query(PlaygroundSave).filter(PlaygroundSave.user_id == user_id)
        if module:
            query = query.filter(PlaygroundSave.module == module)
        saves = query.order_by(PlaygroundSave.updated_at.desc(), PlaygroundSave.id.desc()).all()
        return [_serialize_save(item) for item in saves]
    finally:
        db.close()


@router.post("/saves", response_model=PlaygroundSaveResponse)
def create_playground_save(payload: PlaygroundSavePayload):
    db = _get_db()
    try:
        module = (payload.module or "compiler").strip().lower()
        existing_count = db.query(PlaygroundSave).filter(
            PlaygroundSave.user_id == payload.user_id,
            PlaygroundSave.module == module,
        ).count()
        if existing_count >= 5:
            raise HTTPException(status_code=400, detail="Only 5 saved files are allowed per module. Delete one and try again.")

        save = PlaygroundSave(
            user_id=payload.user_id,
            module=module,
            name=(payload.name or "Untitled").strip(),
            language=(payload.language or "python").strip().lower(),
            code=payload.code or "",
            extra={},
        )
        db.add(save)
        db.commit()
        db.refresh(save)
        return _serialize_save(save)
    finally:
        db.close()


@router.delete("/saves/{save_id}")
def delete_playground_save(save_id: int, user_id: int):
    db = _get_db()
    try:
        save = db.query(PlaygroundSave).filter(
            PlaygroundSave.id == save_id,
            PlaygroundSave.user_id == user_id,
        ).first()
        if not save:
            raise HTTPException(status_code=404, detail="Saved playground file not found.")
        db.delete(save)
        db.commit()
        return {"status": "deleted"}
    finally:
        db.close()


@router.post("/run", response_model=PlaygroundRunResponse)
def run_playground_code(payload: PlaygroundRunRequest):
    language = str(payload.language or "").strip().lower()
    if language not in SUPPORTED_LANGUAGES:
        return _unsupported_language_response(language)

    if language == "python":
        output, errors, runtime, status = _run_python(payload.code, payload.stdin or "")
    else:
        output, errors, runtime, status = _run_javascript(payload.code, payload.stdin or "")

    return _build_response(language, output, errors, runtime, status)


@router.post("/run-with-files", response_model=PlaygroundRunResponse)
def run_playground_code_with_files(
    language: str = Form(...),
    code: str = Form(...),
    stdin: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    selected = str(language or "").strip().lower()
    if selected not in SUPPORTED_LANGUAGES:
        return _unsupported_language_response(selected)

    if selected == "python":
        output, errors, runtime, status = _run_python(code, stdin or "", files)
    else:
        output, errors, runtime, status = _run_javascript(code, stdin or "", files)

    return _build_response(selected, output, errors, runtime, status)


@router.get("/streamlit/status", response_model=StreamlitSessionResponse)
def get_streamlit_status():
    process = STREAMLIT_SESSION.get("process")
    port = STREAMLIT_SESSION.get("port")
    if process and process.poll() is None and port:
        return StreamlitSessionResponse(
            status="running",
            url=f"http://127.0.0.1:{port}",
            port=port,
            started_at=STREAMLIT_SESSION.get("started_at"),
            message="Streamlit playground is running.",
        )
    return StreamlitSessionResponse(status="stopped", message="No Streamlit playground session is active.")


@router.post("/streamlit/start", response_model=StreamlitSessionResponse)
def start_streamlit_playground(
    code: str = Form(...),
    files: list[UploadFile] = File(default=[]),
):
    port = _build_streamlit_session(code, files)
    return StreamlitSessionResponse(
        status="running",
        url=f"http://127.0.0.1:{port}",
        port=port,
        started_at=STREAMLIT_SESSION.get("started_at"),
        message="Streamlit playground launched successfully.",
    )


@router.post("/streamlit/stop", response_model=StreamlitSessionResponse)
def stop_streamlit_playground():
    _stop_streamlit_session()
    return StreamlitSessionResponse(status="stopped", message="Streamlit playground stopped.")
