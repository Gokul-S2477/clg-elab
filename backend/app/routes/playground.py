import asyncio
import asyncio
import json
import os
import re
import shutil
import sqlite3
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.user import PlaygroundSave


router = APIRouter(prefix="/playground", tags=["playground"])


SUPPORTED_LANGUAGES = {"python", "javascript"}
ONECOMPILER_API_URL = "https://api.onecompiler.com/v1/run"
ONECOMPILER_API_KEY = os.getenv("ONECOMPILER_API_KEY", "").strip()
PLAYGROUND_SAVE_LIMIT = max(1, int(os.getenv("PLAYGROUND_SAVE_LIMIT", "5")))
SQL_MAX_ROW_LIMIT = max(50, int(os.getenv("PLAYGROUND_SQL_MAX_ROW_LIMIT", "500")))
SQL_DEFAULT_PAGE_SIZE = max(10, int(os.getenv("PLAYGROUND_SQL_DEFAULT_PAGE_SIZE", "100")))
PLAYGROUND_EXEC_TIMEOUT_SECONDS = max(3, int(os.getenv("PLAYGROUND_EXEC_TIMEOUT_SECONDS", "12")))
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
READ_ONLY_SQL_PREFIX = re.compile(r"^\s*(with|select|explain)\b", re.IGNORECASE)

SQL_DATASETS: dict[str, dict[str, Any]] = {
    "hr": {
        "name": "HR Analytics",
        "description": "Employee, department, and salary data for HR reporting practice.",
        "diagram_key": "hr",
        "sample_queries": [
            "SELECT d.department_name, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.department_id = e.department_id GROUP BY d.department_name ORDER BY avg_salary DESC;",
            "SELECT first_name, last_name, salary FROM employees WHERE salary > 90000 ORDER BY salary DESC;",
            "SELECT manager_id, COUNT(*) AS reports FROM employees WHERE manager_id IS NOT NULL GROUP BY manager_id ORDER BY reports DESC;",
        ],
        "relationships": [
            {"from_table": "employees", "from_column": "department_id", "to_table": "departments", "to_column": "department_id"},
            {"from_table": "employees", "from_column": "manager_id", "to_table": "employees", "to_column": "employee_id"},
            {"from_table": "leave_requests", "from_column": "employee_id", "to_table": "employees", "to_column": "employee_id"},
        ],
        "tables": [
            {
                "name": "departments",
                "columns": [
                    ("department_id", "INTEGER PRIMARY KEY"),
                    ("department_name", "TEXT"),
                    ("location", "TEXT"),
                ],
                "rows": [
                    (10, "Engineering", "Bengaluru"),
                    (20, "Sales", "Chennai"),
                    (30, "Finance", "Hyderabad"),
                    (40, "HR", "Mumbai"),
                ],
            },
            {
                "name": "employees",
                "columns": [
                    ("employee_id", "INTEGER PRIMARY KEY"),
                    ("first_name", "TEXT"),
                    ("last_name", "TEXT"),
                    ("department_id", "INTEGER"),
                    ("job_title", "TEXT"),
                    ("salary", "INTEGER"),
                    ("hire_date", "TEXT"),
                    ("manager_id", "INTEGER"),
                ],
                "rows": [
                    (101, "Ananya", "Rao", 10, "Software Engineer", 86000, "2021-05-14", 106),
                    (102, "Karthik", "Menon", 10, "Data Engineer", 98000, "2020-03-11", 106),
                    (103, "Divya", "Nair", 20, "Sales Executive", 72000, "2022-07-19", 107),
                    (104, "Vikram", "Iyer", 20, "Account Manager", 91000, "2019-10-02", 107),
                    (105, "Meera", "Shah", 30, "Financial Analyst", 83000, "2021-01-27", 108),
                    (106, "Rahul", "Kapoor", 10, "Engineering Manager", 132000, "2018-04-05", None),
                    (107, "Sonia", "Bose", 20, "Sales Manager", 121000, "2017-09-09", None),
                    (108, "Amit", "Gupta", 30, "Finance Manager", 128000, "2016-02-16", None),
                    (109, "Nisha", "Patel", 40, "HR Specialist", 69000, "2023-01-12", 110),
                    (110, "Priya", "Das", 40, "HR Manager", 116000, "2018-11-01", None),
                ],
            },
            {
                "name": "leave_requests",
                "columns": [
                    ("request_id", "INTEGER PRIMARY KEY"),
                    ("employee_id", "INTEGER"),
                    ("leave_type", "TEXT"),
                    ("start_date", "TEXT"),
                    ("end_date", "TEXT"),
                    ("status", "TEXT"),
                ],
                "rows": [
                    (1, 101, "Casual", "2025-02-14", "2025-02-16", "Approved"),
                    (2, 103, "Sick", "2025-01-22", "2025-01-23", "Approved"),
                    (3, 105, "Vacation", "2025-03-01", "2025-03-06", "Pending"),
                    (4, 109, "Casual", "2025-02-03", "2025-02-03", "Rejected"),
                ],
            },
        ],
    },
    "northwind": {
        "name": "Northwind",
        "description": "Classic order-management schema for JOIN and aggregate SQL practice.",
        "diagram_key": "northwind",
        "sample_queries": [
            "SELECT c.company_name, COUNT(o.order_id) AS total_orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.company_name ORDER BY total_orders DESC;",
            "SELECT p.product_name, SUM(od.quantity) AS units_sold FROM order_details od JOIN products p ON p.product_id = od.product_id GROUP BY p.product_id, p.product_name ORDER BY units_sold DESC LIMIT 5;",
            "SELECT o.ship_country, ROUND(SUM(od.quantity * od.unit_price * (1 - od.discount)), 2) AS revenue FROM orders o JOIN order_details od ON od.order_id = o.order_id GROUP BY o.ship_country ORDER BY revenue DESC;",
        ],
        "relationships": [
            {"from_table": "products", "from_column": "category_id", "to_table": "categories", "to_column": "category_id"},
            {"from_table": "orders", "from_column": "customer_id", "to_table": "customers", "to_column": "customer_id"},
            {"from_table": "orders", "from_column": "employee_id", "to_table": "employees", "to_column": "employee_id"},
            {"from_table": "order_details", "from_column": "order_id", "to_table": "orders", "to_column": "order_id"},
            {"from_table": "order_details", "from_column": "product_id", "to_table": "products", "to_column": "product_id"},
        ],
        "tables": [
            {
                "name": "customers",
                "columns": [
                    ("customer_id", "TEXT PRIMARY KEY"),
                    ("company_name", "TEXT"),
                    ("contact_name", "TEXT"),
                    ("country", "TEXT"),
                    ("city", "TEXT"),
                ],
                "rows": [
                    ("ALFKI", "Alfreds Futterkiste", "Maria Anders", "Germany", "Berlin"),
                    ("ANATR", "Ana Trujillo Emparedados", "Ana Trujillo", "Mexico", "Mexico D.F."),
                    ("BLONP", "Blondesddsl pere et fils", "Fridrich", "France", "Strasbourg"),
                    ("BERGS", "Berglunds snabbkop", "Christina", "Sweden", "Lulea"),
                ],
            },
            {
                "name": "employees",
                "columns": [
                    ("employee_id", "INTEGER PRIMARY KEY"),
                    ("first_name", "TEXT"),
                    ("last_name", "TEXT"),
                    ("title", "TEXT"),
                ],
                "rows": [
                    (1, "Nancy", "Davolio", "Sales Representative"),
                    (2, "Andrew", "Fuller", "Vice President"),
                    (3, "Janet", "Leverling", "Sales Representative"),
                    (4, "Margaret", "Peacock", "Sales Representative"),
                ],
            },
            {
                "name": "categories",
                "columns": [
                    ("category_id", "INTEGER PRIMARY KEY"),
                    ("category_name", "TEXT"),
                ],
                "rows": [
                    (1, "Beverages"),
                    (2, "Condiments"),
                    (3, "Produce"),
                ],
            },
            {
                "name": "products",
                "columns": [
                    ("product_id", "INTEGER PRIMARY KEY"),
                    ("product_name", "TEXT"),
                    ("category_id", "INTEGER"),
                    ("unit_price", "REAL"),
                    ("discontinued", "INTEGER"),
                ],
                "rows": [
                    (1, "Chai", 1, 18.0, 0),
                    (2, "Chang", 1, 19.0, 0),
                    (3, "Aniseed Syrup", 2, 10.0, 0),
                    (4, "Chef Anton's Cajun Seasoning", 2, 22.0, 0),
                    (5, "Uncle Bob's Organic Dried Pears", 3, 30.0, 0),
                ],
            },
            {
                "name": "orders",
                "columns": [
                    ("order_id", "INTEGER PRIMARY KEY"),
                    ("customer_id", "TEXT"),
                    ("employee_id", "INTEGER"),
                    ("order_date", "TEXT"),
                    ("ship_country", "TEXT"),
                    ("freight", "REAL"),
                ],
                "rows": [
                    (10248, "ALFKI", 1, "2025-01-10", "Germany", 32.38),
                    (10249, "ANATR", 2, "2025-01-12", "Mexico", 11.61),
                    (10250, "ALFKI", 3, "2025-01-15", "Germany", 65.83),
                    (10251, "BERGS", 4, "2025-01-16", "Sweden", 41.34),
                    (10252, "BLONP", 3, "2025-01-17", "France", 51.3),
                ],
            },
            {
                "name": "order_details",
                "columns": [
                    ("order_id", "INTEGER"),
                    ("product_id", "INTEGER"),
                    ("unit_price", "REAL"),
                    ("quantity", "INTEGER"),
                    ("discount", "REAL"),
                ],
                "rows": [
                    (10248, 1, 18.0, 12, 0.0),
                    (10248, 3, 10.0, 10, 0.0),
                    (10249, 2, 19.0, 5, 0.0),
                    (10250, 5, 30.0, 9, 0.1),
                    (10251, 4, 22.0, 6, 0.0),
                    (10252, 1, 18.0, 40, 0.05),
                ],
            },
        ],
    },
    "sales_mart": {
        "name": "Sales Mart",
        "description": "Retail dataset for practicing cohorts, repeat buyers, and product performance.",
        "diagram_key": "sales_mart",
        "sample_queries": [
            "SELECT strftime('%Y-%m', order_date) AS month, ROUND(SUM(total_amount), 2) AS revenue FROM orders GROUP BY month ORDER BY month;",
            "SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS sales FROM order_items oi JOIN products p ON p.product_id = oi.product_id GROUP BY p.category ORDER BY sales DESC;",
            "SELECT c.full_name, COUNT(o.order_id) AS order_count FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_id, c.full_name HAVING COUNT(o.order_id) > 1 ORDER BY order_count DESC;",
        ],
        "relationships": [
            {"from_table": "orders", "from_column": "customer_id", "to_table": "customers", "to_column": "customer_id"},
            {"from_table": "order_items", "from_column": "order_id", "to_table": "orders", "to_column": "order_id"},
            {"from_table": "order_items", "from_column": "product_id", "to_table": "products", "to_column": "product_id"},
        ],
        "tables": [
            {
                "name": "customers",
                "columns": [
                    ("customer_id", "INTEGER PRIMARY KEY"),
                    ("full_name", "TEXT"),
                    ("city", "TEXT"),
                    ("signup_date", "TEXT"),
                ],
                "rows": [
                    (1, "Arun Kumar", "Bengaluru", "2024-09-01"),
                    (2, "Bhavna Reddy", "Chennai", "2024-10-21"),
                    (3, "Charan Singh", "Hyderabad", "2025-01-08"),
                    (4, "Deepa Menon", "Kochi", "2025-02-10"),
                ],
            },
            {
                "name": "products",
                "columns": [
                    ("product_id", "INTEGER PRIMARY KEY"),
                    ("product_name", "TEXT"),
                    ("category", "TEXT"),
                    ("unit_price", "REAL"),
                ],
                "rows": [
                    (100, "Wireless Mouse", "Accessories", 799.0),
                    (101, "Mechanical Keyboard", "Accessories", 2899.0),
                    (102, "27in Monitor", "Displays", 13999.0),
                    (103, "USB-C Dock", "Accessories", 4599.0),
                    (104, "External SSD 1TB", "Storage", 6899.0),
                ],
            },
            {
                "name": "orders",
                "columns": [
                    ("order_id", "INTEGER PRIMARY KEY"),
                    ("customer_id", "INTEGER"),
                    ("order_date", "TEXT"),
                    ("channel", "TEXT"),
                    ("total_amount", "REAL"),
                ],
                "rows": [
                    (5001, 1, "2025-02-02", "web", 3698.0),
                    (5002, 2, "2025-02-07", "mobile", 13999.0),
                    (5003, 1, "2025-03-12", "web", 6899.0),
                    (5004, 3, "2025-03-18", "store", 5398.0),
                    (5005, 4, "2025-03-20", "mobile", 2899.0),
                ],
            },
            {
                "name": "order_items",
                "columns": [
                    ("order_id", "INTEGER"),
                    ("product_id", "INTEGER"),
                    ("quantity", "INTEGER"),
                    ("unit_price", "REAL"),
                ],
                "rows": [
                    (5001, 100, 1, 799.0),
                    (5001, 101, 1, 2899.0),
                    (5002, 102, 1, 13999.0),
                    (5003, 104, 1, 6899.0),
                    (5004, 100, 1, 799.0),
                    (5004, 103, 1, 4599.0),
                    (5005, 101, 1, 2899.0),
                ],
            },
        ],
    },
}


def _try_load_northwind_from_kaggle() -> None:
    """Optionally hydrate orders/order_details from KaggleHub when enabled.

    Requires kaggle credentials available in the backend runtime.
    """
    try:
        import pandas as pd  # type: ignore
        import kagglehub  # type: ignore
        from kagglehub import KaggleDatasetAdapter  # type: ignore
    except Exception:
        return

    dataset_ref = os.getenv("NORTHWIND_KAGGLE_DATASET", "emmanueltugbeh/northwind-orders-and-order-details").strip()
    file_candidates = {
        "orders": ["orders.csv", "Orders.csv", "northwind_orders.csv"],
        "order_details": ["order_details.csv", "Order Details.csv", "order-details.csv"],
    }
    loaded_frames: dict[str, Any] = {}
    for table_name, candidates in file_candidates.items():
        for file_path in candidates:
            try:
                frame = kagglehub.load_dataset(
                    KaggleDatasetAdapter.PANDAS,
                    dataset_ref,
                    file_path,
                )
                if frame is not None and len(frame.index) > 0:
                    loaded_frames[table_name] = frame
                    break
            except Exception:
                continue

    if "orders" not in loaded_frames and "order_details" not in loaded_frames:
        return

    northwind = SQL_DATASETS.get("northwind")
    if not northwind:
        return

    table_map = {table["name"]: table for table in northwind.get("tables", [])}

    def _to_rows(frame: Any, expected_columns: list[str]) -> list[tuple[Any, ...]]:
        normalized = {str(col).strip().lower().replace(" ", "_"): col for col in frame.columns}
        selected_cols = [normalized.get(col, None) for col in expected_columns]
        if any(col is None for col in selected_cols):
            return []
        subset = frame[selected_cols].copy()
        subset.columns = expected_columns
        subset = subset.where(pd.notna(subset), None)
        rows: list[tuple[Any, ...]] = []
        for _, record in subset.iterrows():
            rows.append(tuple(record[col] for col in expected_columns))
        return rows

    orders_table = table_map.get("orders")
    if orders_table and "orders" in loaded_frames:
        expected = [col for col, _ in orders_table.get("columns", [])]
        kaggle_rows = _to_rows(loaded_frames["orders"], expected)
        if kaggle_rows:
            orders_table["rows"] = kaggle_rows

    details_table = table_map.get("order_details")
    if details_table and "order_details" in loaded_frames:
        expected = [col for col, _ in details_table.get("columns", [])]
        kaggle_rows = _to_rows(loaded_frames["order_details"], expected)
        if kaggle_rows:
            details_table["rows"] = kaggle_rows
    northwind["source"] = f"kaggle:{dataset_ref}"
    northwind["description"] = "Northwind dataset hydrated from Kaggle (available files loaded)."


_try_load_northwind_from_kaggle()


def _normalize_sqlite_cell(value: Any) -> Any:
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value.hex()
    return value


def _build_relationships_from_sqlite(connection: sqlite3.Connection, table_names: list[str]) -> list[dict[str, str]]:
    relationships: list[dict[str, str]] = []
    cursor = connection.cursor()
    for table_name in table_names:
        try:
            cursor.execute(f"PRAGMA foreign_key_list({table_name})")
            for row in cursor.fetchall():
                relationships.append(
                    {
                        "from_table": table_name,
                        "from_column": str(row[3]),
                        "to_table": str(row[2]),
                        "to_column": str(row[4]),
                    }
                )
        except Exception:
            continue
    return relationships


def _load_northwind_from_sqlite_path(db_path: str) -> bool:
    try:
        connection = sqlite3.connect(db_path)
        cursor = connection.cursor()
        cursor.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
        table_names = [str(row[0]) for row in cursor.fetchall()]
        if not table_names:
            connection.close()
            return False

        existing = {name.lower() for name in table_names}
        if not NORTHWIND_REQUIRED_TABLES.issubset(existing):
            connection.close()
            return False

        max_rows = max(100, int(os.getenv("NORTHWIND_SQLITE_MAX_ROWS", "50000")))
        tables: list[dict[str, Any]] = []
        for table_name in table_names:
            cursor.execute(f"PRAGMA table_info({table_name})")
            col_info = cursor.fetchall()
            columns = [
                (
                    str(col[1]),
                    ("TEXT" if not str(col[2]).strip() else str(col[2]).upper()) + (" PRIMARY KEY" if int(col[5]) == 1 else ""),
                )
                for col in col_info
            ]

            cursor.execute(f"SELECT * FROM {table_name} LIMIT {max_rows}")
            rows = [tuple(_normalize_sqlite_cell(value) for value in row) for row in cursor.fetchall()]
            tables.append({"name": table_name, "columns": columns, "rows": rows})

        northwind = SQL_DATASETS.get("northwind")
        if northwind:
            northwind["tables"] = tables
            northwind["relationships"] = _build_relationships_from_sqlite(connection, table_names)
            northwind["description"] = "Complete Northwind loaded from local SQLite file."
            northwind["source"] = f"sqlite:{db_path}"

        connection.close()
        return True
    except Exception:
        return False


def _try_load_northwind_from_sqlite_file() -> None:
    """Load complete Northwind from local sqlite file when available."""
    candidates = [
        os.getenv("NORTHWIND_SQLITE_PATH", "").strip(),
        "backend/data/northwind.db",
        "data/northwind.db",
        "northwind.db",
    ]
    db_path = next((candidate for candidate in candidates if candidate and Path(candidate).exists()), None)
    if not db_path:
        return
    _load_northwind_from_sqlite_path(db_path)


_try_load_northwind_from_sqlite_file()


def _inspect_sqlite_dataset_schema(db_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()
    cursor.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
    table_names = [str(row[0]) for row in cursor.fetchall()]
    tables: list[dict[str, Any]] = []
    for table_name in table_names:
        cursor.execute(f"PRAGMA table_info({table_name})")
        col_info = cursor.fetchall()
        columns = [
            (
                str(col[1]),
                ("TEXT" if not str(col[2]).strip() else str(col[2]).upper()) + (" PRIMARY KEY" if int(col[5]) == 1 else ""),
            )
            for col in col_info
        ]
        row_count = int(cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0])
        tables.append({"name": table_name, "columns": columns, "rows": [], "row_count": row_count})
    relationships = _build_relationships_from_sqlite(connection, table_names)
    connection.close()
    return tables, relationships


def _register_sqlite_backed_dataset(
    *,
    dataset_id: str,
    name: str,
    description: str,
    db_path: str,
    sample_queries: list[str],
) -> None:
    path = Path(db_path)
    if not path.exists():
        return
    tables, relationships = _inspect_sqlite_dataset_schema(path)
    SQL_DATASETS[dataset_id] = {
        "name": name,
        "description": description,
        "sample_queries": sample_queries,
        "tables": tables,
        "relationships": relationships,
        "source": f"sqlite:{path.as_posix()}",
        "sqlite_path": str(path),
    }


def _register_local_csv_datasets() -> None:
    def _pick_path(*candidates: str) -> str:
        for candidate in candidates:
            if Path(candidate).exists():
                return candidate
        return candidates[0]

    _register_sqlite_backed_dataset(
        dataset_id="student_exam",
        name="Student Exam Performance",
        description="Student performance factors dataset for aggregation, filtering, and correlation practice.",
        db_path=_pick_path("backend/data/student_exam.db", "data/student_exam.db"),
        sample_queries=[
            "SELECT School_Type, ROUND(AVG(Exam_Score), 2) AS avg_score FROM student_performance_factors GROUP BY School_Type ORDER BY avg_score DESC;",
            "SELECT Gender, ROUND(AVG(Exam_Score), 2) AS avg_score FROM student_performance_factors GROUP BY Gender ORDER BY avg_score DESC;",
            "SELECT Hours_Studied, Exam_Score FROM student_performance_factors ORDER BY Hours_Studied DESC LIMIT 25;",
        ],
    )
    _register_sqlite_backed_dataset(
        dataset_id="ipl",
        name="IPL Matches + Deliveries",
        description="Ball-by-ball IPL dataset for match, team, and player analytics practice.",
        db_path=_pick_path("backend/data/ipl.db", "data/ipl.db"),
        sample_queries=[
            "SELECT season, COUNT(*) AS matches_played FROM matches GROUP BY season ORDER BY season;",
            "SELECT batter, SUM(batsman_runs) AS total_runs FROM deliveries GROUP BY batter ORDER BY total_runs DESC LIMIT 10;",
            "SELECT m.season, d.bowling_team, SUM(d.is_wicket) AS wickets FROM deliveries d JOIN matches m ON m.id = d.match_id GROUP BY m.season, d.bowling_team ORDER BY wickets DESC LIMIT 20;",
        ],
    )


_register_local_csv_datasets()


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
    extra: Optional[dict[str, Any]] = None


class PlaygroundSaveResponse(BaseModel):
    id: int
    user_id: int
    module: str
    name: str
    language: str
    code: str
    extra: Optional[dict[str, Any]] = None
    updated_at: Optional[float] = None


class OneCompilerProxyStatusResponse(BaseModel):
    configured: bool
    provider: str = "onecompiler"
    message: str


class OneCompilerRunProxyRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str | list[str]] = ""
    files: Optional[list[dict[str, str]]] = None


class OneCompilerRunProxyResponse(BaseModel):
    configured: bool
    provider: str = "onecompiler"
    data: Optional[Any] = None
    error: Optional[str] = None


class PlaygroundRuntimeFile(BaseModel):
    name: str
    content: str


class PlaygroundRuntimeRequest(BaseModel):
    language: str
    stdin: Optional[str] = ""
    files: list[PlaygroundRuntimeFile]


class SqlDatasetColumn(BaseModel):
    name: str
    type: str


class SqlDatasetTable(BaseModel):
    name: str
    columns: list[SqlDatasetColumn]
    row_count: int


class SqlDatasetRelation(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str


class SqlDatasetInfo(BaseModel):
    id: str
    name: str
    description: str
    sample_queries: list[str]
    tables: list[SqlDatasetTable]
    relationships: list[SqlDatasetRelation] = []
    diagram_key: Optional[str] = None
    source: Optional[str] = None


class SqlPlaygroundDatasetsResponse(BaseModel):
    datasets: list[SqlDatasetInfo]


class SqlPlaygroundRunRequest(BaseModel):
    dataset_id: str
    query: str
    row_limit: int = 200
    row_offset: int = 0


class SqlPlaygroundRunResponse(BaseModel):
    dataset_id: str
    output: str
    columns: list[str] = []
    rows: list[dict[str, Any]] = []
    row_count: int = 0
    row_offset: int = 0
    row_limit: int = 0
    returned_rows: int = 0
    truncated: bool = False
    errors: Optional[str] = None
    status: str
    execution_time_ms: float


class NotebookRunRequest(BaseModel):
    language: str = "python"
    cells: list[str]
    run_index: Optional[int] = None
    stdin: Optional[str] = ""


class NotebookRunResponse(BaseModel):
    language: str
    run_index: int
    output: str
    errors: Optional[str] = None
    status: str
    execution_time_ms: float


class NorthwindSyncResponse(BaseModel):
    loaded: bool
    source: Optional[str] = None
    table_count: int
    row_count: int
    message: str
    is_complete: bool = False
    missing_core_tables: list[str] = []


NORTHWIND_REQUIRED_TABLES = {
    "categories",
    "customers",
    "employees",
    "order_details",
    "orders",
    "products",
    "suppliers",
}


def _serialize_save(save: PlaygroundSave) -> PlaygroundSaveResponse:
    return PlaygroundSaveResponse(
        id=save.id,
        user_id=save.user_id,
        module=save.module,
        name=save.name,
        language=save.language,
        code=save.code,
        extra=save.extra or {},
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


def _run_process(command: list[str], script_path: Path, stdin: str, timeout_seconds: int = PLAYGROUND_EXEC_TIMEOUT_SECONDS):
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


def _onecompiler_api_key() -> str:
    return os.getenv("ONECOMPILER_API_KEY", ONECOMPILER_API_KEY).strip()


def _post_to_onecompiler(payload: dict[str, Any]) -> Any:
    request = urllib.request.Request(
        ONECOMPILER_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-API-Key": _onecompiler_api_key(),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw_body = response.read().decode("utf-8")
    return json.loads(raw_body) if raw_body else {}


def _run_runtime_files(language: str, files: list[PlaygroundRuntimeFile], stdin: str):
    if not files:
        return "(no output)\n", "At least one file is required.", 0, "error"
    temp_dir = Path(tempfile.mkdtemp(prefix=f"playground-runtime-{language}-"))
    try:
        for file_item in files:
            safe_name = Path(file_item.name or "").name
            if not safe_name:
                continue
            target = temp_dir / safe_name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(file_item.content or "", encoding="utf-8")

        if language == "python":
            entry = temp_dir / "main.py"
            if not entry.exists():
                return "(no output)\n", "main.py is required for Python runtime.", 0, "error"
            return _run_process(["python"], entry, stdin)
        if language == "javascript":
            entry = temp_dir / "main.js"
            if not entry.exists():
                return "(no output)\n", "main.js is required for JavaScript runtime.", 0, "error"
            return _run_process(["node"], entry, stdin)
        return "(no output)\n", f"Runtime execution is not configured for {language}.", 0, "error"
    finally:
        _cleanup_temp_dir(temp_dir)


def _format_table_output(columns: list[str], rows: list[dict[str, Any]]) -> str:
    if not columns:
        return "Query executed successfully."
    lines = [" | ".join(columns), "-" * max(3, len(" | ".join(columns)))]
    for row in rows:
        lines.append(" | ".join(str(row.get(col, "")) for col in columns))
    return "\n".join(lines)


def _build_dataset_connection(dataset_id: str) -> tuple[sqlite3.Connection, dict[str, Any]]:
    dataset = SQL_DATASETS.get(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Unknown dataset.")

    sqlite_path = dataset.get("sqlite_path")
    if sqlite_path:
        path = Path(str(sqlite_path))
        if not path.exists():
            raise HTTPException(status_code=404, detail="Dataset backing file is missing on server.")
        connection = sqlite3.connect(str(path))
        connection.row_factory = sqlite3.Row
        return connection, dataset

    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()
    for table in dataset.get("tables", []):
        table_name = table["name"]
        columns = table.get("columns", [])
        rows = table.get("rows", [])
        ddl = ", ".join(f"{name} {data_type}" for name, data_type in columns)
        cursor.execute(f"CREATE TABLE {table_name} ({ddl})")
        if rows:
            placeholders = ", ".join("?" for _ in columns)
            cursor.executemany(f"INSERT INTO {table_name} VALUES ({placeholders})", rows)
    connection.commit()
    return connection, dataset


def _northwind_stats() -> tuple[int, int, Optional[str], bool, list[str]]:
    dataset = SQL_DATASETS.get("northwind", {})
    tables = dataset.get("tables", []) or []
    table_count = len(tables)
    row_count = sum(len(table.get("rows", []) or []) for table in tables)
    table_names = {str(table.get("name", "")).lower() for table in tables}
    missing = sorted(list(NORTHWIND_REQUIRED_TABLES - table_names))
    is_complete = len(missing) == 0
    return table_count, row_count, dataset.get("source"), is_complete, missing


def _validate_sql_read_only(query: str) -> str:
    cleaned = (query or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query is required.")
    statements = [part.strip() for part in cleaned.split(";") if part.strip()]
    if len(statements) != 1:
        raise HTTPException(status_code=400, detail="Only one SQL statement is allowed.")
    statement = statements[0]
    if not READ_ONLY_SQL_PREFIX.match(statement):
        raise HTTPException(
            status_code=400,
            detail="Only SELECT / WITH / EXPLAIN queries are allowed in SQL Playground.",
        )
    return statement


def _run_notebook_cells(language: str, cells: list[str], run_index: int, stdin: str) -> tuple[str, Optional[str], float, str]:
    temp_dir = Path(tempfile.mkdtemp(prefix=f"playground-notebook-{language}-"))
    try:
        selected_cells = cells[: run_index + 1]
        if language == "python":
            script_path = temp_dir / "main.py"
            script_path.write_text(
                "\n\n".join(f"# --- cell {idx + 1} ---\n{code or ''}" for idx, code in enumerate(selected_cells)),
                encoding="utf-8",
            )
            return _run_process(["python"], script_path, stdin)
        if language == "javascript":
            script_path = temp_dir / "main.js"
            script_path.write_text(
                "\n\n".join(f"// --- cell {idx + 1} ---\n{code or ''}" for idx, code in enumerate(selected_cells)),
                encoding="utf-8",
            )
            return _run_process(["node"], script_path, stdin)
        return "(no output)\n", f"{language} is not supported in Notebook Lab yet.", 0, "error"
    finally:
        _cleanup_temp_dir(temp_dir)


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
        "sql_playground_supported": True,
        "sql_northwind_import_supported": True,
        "notebook_lab_supported": True,
        "notebook_languages": ["python", "javascript"],
        "save_limit": PLAYGROUND_SAVE_LIMIT,
        "sql_max_row_limit": SQL_MAX_ROW_LIMIT,
        "sql_default_page_size": SQL_DEFAULT_PAGE_SIZE,
        "execution_timeout_seconds": PLAYGROUND_EXEC_TIMEOUT_SECONDS,
        "sql_datasets": [
            {"id": dataset_id, "name": dataset["name"]}
            for dataset_id, dataset in SQL_DATASETS.items()
        ],
        "coming_soon": ["java", "cpp"],
    }


@router.get("/sql/datasets", response_model=SqlPlaygroundDatasetsResponse)
def list_sql_playground_datasets():
    _try_load_northwind_from_sqlite_file()
    datasets: list[SqlDatasetInfo] = []
    for dataset_id, dataset in SQL_DATASETS.items():
        tables = [
            SqlDatasetTable(
                name=table["name"],
                columns=[SqlDatasetColumn(name=name, type=data_type) for name, data_type in table.get("columns", [])],
                row_count=int(table.get("row_count", len(table.get("rows", [])))),
            )
            for table in dataset.get("tables", [])
        ]
        datasets.append(
            SqlDatasetInfo(
                id=dataset_id,
                name=dataset["name"],
                description=dataset["description"],
                sample_queries=dataset.get("sample_queries", []),
                tables=tables,
                relationships=[
                    SqlDatasetRelation(
                        from_table=rel["from_table"],
                        from_column=rel["from_column"],
                        to_table=rel["to_table"],
                        to_column=rel["to_column"],
                    )
                    for rel in dataset.get("relationships", [])
                ],
                diagram_key=dataset.get("diagram_key"),
                source=dataset.get("source"),
            )
        )
    return SqlPlaygroundDatasetsResponse(datasets=datasets)


@router.get("/sql/northwind/status", response_model=NorthwindSyncResponse)
def get_northwind_status():
    _try_load_northwind_from_sqlite_file()
    table_count, row_count, source, is_complete, missing = _northwind_stats()
    loaded = table_count > 0 and row_count > 0
    message = "Northwind dataset is ready." if loaded else "Northwind dataset is empty."
    if source and source.startswith("sqlite:"):
        message = "Northwind loaded from local SQLite source."
    elif source and source.startswith("kaggle:"):
        message = "Northwind partially hydrated from Kaggle dataset."
    return NorthwindSyncResponse(
        loaded=loaded,
        source=source,
        table_count=table_count,
        row_count=row_count,
        message=message,
        is_complete=is_complete,
        missing_core_tables=missing,
    )


@router.post("/sql/northwind/sync", response_model=NorthwindSyncResponse)
def sync_northwind_dataset():
    _try_load_northwind_from_kaggle()
    _try_load_northwind_from_sqlite_file()
    table_count, row_count, source, is_complete, missing = _northwind_stats()
    loaded = table_count > 0 and row_count > 0
    message = "Northwind sync completed." if loaded else "Northwind sync did not load additional rows."
    return NorthwindSyncResponse(
        loaded=loaded,
        source=source,
        table_count=table_count,
        row_count=row_count,
        message=message,
        is_complete=is_complete,
        missing_core_tables=missing,
    )


@router.post("/sql/northwind/import-db", response_model=NorthwindSyncResponse)
def import_northwind_sqlite(file: UploadFile = File(...)):
    safe_name = Path(file.filename or "northwind.db").name.lower()
    if not (safe_name.endswith(".db") or safe_name.endswith(".sqlite") or safe_name.endswith(".sqlite3")):
        raise HTTPException(status_code=400, detail="Please upload a SQLite database file (.db/.sqlite/.sqlite3).")

    target_dir = Path("backend/data")
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / "northwind.db"
    target_path.write_bytes(file.file.read())

    loaded = _load_northwind_from_sqlite_path(str(target_path))
    table_count, row_count, source, is_complete, missing = _northwind_stats()
    if not loaded:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid Northwind SQLite database (required core tables missing).",
        )
    return NorthwindSyncResponse(
        loaded=True,
        source=source,
        table_count=table_count,
        row_count=row_count,
        message="Northwind imported successfully from uploaded SQLite database.",
        is_complete=is_complete,
        missing_core_tables=missing,
    )


@router.post("/sql/run", response_model=SqlPlaygroundRunResponse)
def run_sql_playground_query(payload: SqlPlaygroundRunRequest):
    statement = _validate_sql_read_only(payload.query)
    row_limit = max(1, min(int(payload.row_limit or SQL_DEFAULT_PAGE_SIZE), SQL_MAX_ROW_LIMIT))
    row_offset = max(0, int(payload.row_offset or 0))
    start = time.perf_counter()
    connection, _ = _build_dataset_connection(payload.dataset_id)
    try:
        cursor = connection.cursor()
        lowered = statement.strip().lower()
        if lowered.startswith("explain"):
            cursor.execute(statement)
            columns = [column[0] for column in (cursor.description or [])]
            fetched_rows = cursor.fetchall() if columns else []
            total_rows = len(fetched_rows)
            visible_rows = fetched_rows[row_offset:row_offset + row_limit]
        else:
            paged_sql = f"SELECT * FROM ({statement}) AS _playground_query LIMIT ? OFFSET ?"
            count_sql = f"SELECT COUNT(*) FROM ({statement}) AS _playground_query"
            cursor.execute(count_sql)
            total_rows = int(cursor.fetchone()[0] or 0)
            cursor.execute(paged_sql, (row_limit, row_offset))
            columns = [column[0] for column in (cursor.description or [])]
            visible_rows = cursor.fetchall() if columns else []
        rows = [{col: row[col] for col in columns} for row in visible_rows]
        truncated = (row_offset + len(rows)) < total_rows
        output = _format_table_output(columns, rows)
        runtime = (time.perf_counter() - start) * 1000
        return SqlPlaygroundRunResponse(
            dataset_id=payload.dataset_id,
            output=output,
            columns=columns,
            rows=rows,
            row_count=total_rows,
            row_offset=row_offset,
            row_limit=row_limit,
            returned_rows=len(rows),
            truncated=truncated,
            status="success",
            execution_time_ms=runtime,
        )
    except HTTPException:
        raise
    except Exception as exc:
        runtime = (time.perf_counter() - start) * 1000
        return SqlPlaygroundRunResponse(
            dataset_id=payload.dataset_id,
            output="(no output)\n",
            errors=str(exc),
            status="error",
            execution_time_ms=runtime,
        )
    finally:
        connection.close()


@router.post("/notebook/run", response_model=NotebookRunResponse)
def run_notebook_lab(payload: NotebookRunRequest):
    cells = payload.cells or []
    if not cells:
        raise HTTPException(status_code=400, detail="At least one notebook cell is required.")
    run_index = payload.run_index if payload.run_index is not None else len(cells) - 1
    if run_index < 0 or run_index >= len(cells):
        raise HTTPException(status_code=400, detail="run_index is out of range for provided cells.")
    language = str(payload.language or "python").strip().lower()
    output, errors, runtime, status = _run_notebook_cells(language, cells, run_index, payload.stdin or "")
    return NotebookRunResponse(
        language=language,
        run_index=run_index,
        output=output,
        errors=errors,
        status=status,
        execution_time_ms=runtime,
    )


@router.get("/onecompiler/status", response_model=OneCompilerProxyStatusResponse)
def get_onecompiler_proxy_status():
    configured = bool(_onecompiler_api_key())
    return OneCompilerProxyStatusResponse(
        configured=configured,
        message="Execution metadata proxy is ready." if configured else "Set ONECOMPILER_API_KEY to enable OneCompiler execution metadata.",
    )


@router.post("/onecompiler/run", response_model=OneCompilerRunProxyResponse)
def proxy_onecompiler_run(payload: OneCompilerRunProxyRequest):
    api_key = _onecompiler_api_key()
    if not api_key:
        return OneCompilerRunProxyResponse(
            configured=False,
            error="ONECOMPILER_API_KEY is not configured on the server.",
        )

    file_payload = payload.files or [{"name": "main.txt", "content": payload.code or ""}]
    normalized_files = [
        {"name": str(item.get("name") or "main.txt"), "content": str(item.get("content") or "")}
        for item in file_payload
    ]
    request_body = {
        "language": str(payload.language or "").strip().lower(),
        "stdin": payload.stdin or "",
        "files": normalized_files,
    }

    try:
        response_data = _post_to_onecompiler(request_body)
        return OneCompilerRunProxyResponse(configured=True, data=response_data)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return OneCompilerRunProxyResponse(configured=True, error=detail or f"HTTP {exc.code}")
    except urllib.error.URLError as exc:
        return OneCompilerRunProxyResponse(configured=True, error=str(exc.reason))
    except Exception as exc:
        return OneCompilerRunProxyResponse(configured=True, error=str(exc))


@router.post("/runtime/run", response_model=PlaygroundRunResponse)
def run_playground_runtime(payload: PlaygroundRuntimeRequest):
    language = str(payload.language or "").strip().lower()
    if language not in {"python", "javascript"}:
        return _unsupported_language_response(language)
    output, errors, runtime, status = _run_runtime_files(language, payload.files, payload.stdin or "")
    return _build_response(language, output, errors, runtime, status)


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
        if existing_count >= PLAYGROUND_SAVE_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=f"Only {PLAYGROUND_SAVE_LIMIT} saved files are allowed per module. Delete one and try again.",
            )

        save = PlaygroundSave(
            user_id=payload.user_id,
            module=module,
            name=(payload.name or "Untitled").strip(),
            language=(payload.language or "python").strip().lower(),
            code=payload.code or "",
            extra=payload.extra or {},
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
