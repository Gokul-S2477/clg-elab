from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.crypto import SECRET_PREFIX
from app.models.user import User


def _get_db():
    from app.db import get_db

    yield from get_db()


def _parse_local_token(authorization: Optional[str]) -> Optional[int]:
    header = str(authorization or "").strip()
    if not header.lower().startswith("bearer "):
        return None
    token = header.split(" ", 1)[1].strip()
    if not token.startswith("local-token-"):
        return None
    try:
        return int(token.rsplit("-", 1)[-1])
    except ValueError:
        try:
            return int(token.replace("local-token-", "", 1))
        except ValueError:
            return None


def get_optional_user(authorization: Optional[str] = Header(default=None), db: Session = Depends(_get_db)) -> Optional[User]:
    user_id = _parse_local_token(authorization)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(current_user: Optional[User] = Depends(get_optional_user)) -> User:
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user
