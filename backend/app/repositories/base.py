"""Shared Firestore helpers.

Documents are mapped defensively: a record missing the fields that give it
meaning is skipped rather than defaulted, so a malformed write cannot surface as
a plausible-looking reading.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from google.cloud.firestore_v1 import DocumentSnapshot

from app.firebase.client import get_db


def db():
    return get_db()


def to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    # Firestore Timestamp exposes to_datetime / timestamp_pb
    converter = getattr(value, "ToDatetime", None) or getattr(value, "to_datetime", None)
    if callable(converter):
        result = converter()
        return result if result.tzinfo else result.replace(tzinfo=timezone.utc)
    return None


def to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def snapshot_data(snapshot: DocumentSnapshot) -> dict[str, Any]:
    return snapshot.to_dict() or {}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
