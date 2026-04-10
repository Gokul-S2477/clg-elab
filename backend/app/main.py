import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import reset_database
from app.routes.auth import router as auth_router
from app.routes.playground import router as playground_router
from app.routes.practice_arena import router as practice_arena_router


app = FastAPI(title="ERP Backend")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(practice_arena_router)
app.include_router(playground_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    drop_flag = os.getenv("AUTO_RESET_DB", "false").lower() == "true"
    reset_database(drop_existing=drop_flag)
