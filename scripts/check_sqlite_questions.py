import sqlite3
from pathlib import Path

DB_PATH = Path("backend/test.db")
if not DB_PATH.exists():
    raise SystemExit("test.db not found")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("tables:", tables)
try:
    rows = cur.execute("SELECT COUNT(*) FROM questions").fetchone()
    print("questions count:", rows[0] if rows else 0)
except sqlite3.OperationalError as exc:
    print("error querying questions:", exc)
conn.close()
