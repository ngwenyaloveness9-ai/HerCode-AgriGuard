"""Session and identity."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import NotFoundError
from app.core.security import ROLE_PERMISSIONS, CurrentUser
from app.models.domain import User, UserCreate
from app.repositories import entities

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
def me(principal: CurrentUser) -> dict:
    """Who the caller is and what they may do.

    A verified token with no Firestore profile returns role ``None`` and an
    empty permission set rather than a default role.
    """
    try:
        profile = entities.get_user(principal.uid)
    except NotFoundError:
        profile = None

    return {
        "uid": principal.uid,
        "email": principal.email,
        "profile": profile.model_dump(by_alias=True) if profile else None,
        "role": principal.role,
        "permissions": sorted(ROLE_PERMISSIONS.get(principal.role, set())) if principal.role else [],
    }


@router.post("/profile", response_model=User)
def create_profile(payload: UserCreate, principal: CurrentUser) -> User:
    """Create the caller's own profile after Firebase registration."""
    if payload.id != principal.uid:
        payload = payload.model_copy(update={"id": principal.uid})
    return entities.create_user(payload)
