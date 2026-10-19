import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
import bcrypt
import jwt
from backend.app.core.config import settings


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def generate_api_key_secret(prefix: str = "sentinel_") -> tuple[str, str, str]:
    """
    Generate high-entropy API key.
    Returns:
        (raw_key, key_hash, key_prefix)
    Only the raw_key is returned once to the user.
    key_hash is stored in the database.
    key_prefix is used for fast lookup and display (e.g. 'sentinel_live_a1b2...').
    """
    token = secrets.token_urlsafe(32)
    raw_key = f"{prefix}{token}"
    key_prefix = raw_key[:14] + "..."
    key_hash = hash_api_key(raw_key)
    return raw_key, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """Compute deterministic SHA-256 hash of API key for storage and constant-time lookup."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()
