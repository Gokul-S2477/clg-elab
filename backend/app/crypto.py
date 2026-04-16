import hashlib
from typing import Optional


SECRET_PREFIX = "sha256$"


def hash_secret(secret: str) -> str:
    normalized = str(secret or "")
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"{SECRET_PREFIX}{digest}"


def verify_secret(secret: str, stored_value: Optional[str]) -> bool:
    stored = str(stored_value or "")
    if not stored:
        return False
    if stored.startswith(SECRET_PREFIX):
        return stored == hash_secret(secret)
    return stored == str(secret or "")
