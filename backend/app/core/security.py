"""Authentication and authorisation.

Identity comes from a verified Firebase ID token. The role comes from the user's
Firestore profile; a user with no profile gets no permissions rather than a
default role.
"""

from __future__ import annotations

import hmac
import logging
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.core.errors import ForbiddenError, ServiceUnavailableError, UnauthorisedError
from app.firebase.client import Collections, FirebaseNotConfigured, get_auth, get_db
from app.models.domain import UserRole

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


class Permission:
    CONTROL_ACTUATORS = "CONTROL_ACTUATORS"
    EDIT_CROP_PROFILES = "EDIT_CROP_PROFILES"
    MANAGE_USERS = "MANAGE_USERS"
    EDIT_AUTOMATION = "EDIT_AUTOMATION"
    VIEW = "VIEW"


ROLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.ADMINISTRATOR: {
        Permission.CONTROL_ACTUATORS,
        Permission.EDIT_CROP_PROFILES,
        Permission.MANAGE_USERS,
        Permission.EDIT_AUTOMATION,
        Permission.VIEW,
    },
    UserRole.FARM_MANAGER: {
        Permission.CONTROL_ACTUATORS,
        Permission.EDIT_CROP_PROFILES,
        Permission.EDIT_AUTOMATION,
        Permission.VIEW,
    },
    UserRole.AGRONOMIST: {Permission.EDIT_CROP_PROFILES, Permission.VIEW},
    UserRole.OPERATOR: {Permission.CONTROL_ACTUATORS, Permission.VIEW},
    UserRole.VIEWER: {Permission.VIEW},
}


@dataclass(frozen=True)
class Principal:
    uid: str
    email: str | None
    role: UserRole | None
    farm_ids: tuple[str, ...]

    def has(self, permission: str) -> bool:
        if self.role is None:
            return False
        return permission in ROLE_PERMISSIONS.get(self.role, set())

    def may_access_farm(self, farm_id: str) -> bool:
        if self.role is UserRole.ADMINISTRATOR:
            return True
        return farm_id in self.farm_ids


async def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal:
    if credentials is None or not credentials.credentials:
        raise UnauthorisedError("Authentication required.")

    try:
        decoded = get_auth().verify_id_token(credentials.credentials)
    except FirebaseNotConfigured as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except Exception as exc:
        logger.info("Token verification failed: %s", exc)
        raise UnauthorisedError("Your session is not valid. Sign in again.") from exc

    uid = decoded["uid"]

    role: UserRole | None = None
    farm_ids: tuple[str, ...] = ()
    try:
        snapshot = get_db().collection(Collections.USERS).document(uid).get()
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            raw_role = data.get("role")
            if raw_role in UserRole.__members__.values() or raw_role in {r.value for r in UserRole}:
                role = UserRole(raw_role)
            farm_ids = tuple(data.get("farmIds") or [])
    except Exception as exc:  # pragma: no cover - transport failure
        logger.warning("Could not load profile for %s: %s", uid, exc)

    return Principal(uid=uid, email=decoded.get("email"), role=role, farm_ids=farm_ids)


CurrentUser = Annotated[Principal, Depends(get_principal)]


def require(permission: str):
    """Dependency factory guarding a route behind a permission."""

    async def guard(principal: CurrentUser) -> Principal:
        if not principal.has(permission):
            raise ForbiddenError(
                "Your role does not allow this action. Ask your farm administrator to adjust it."
            )
        return principal

    return guard


def require_farm_access(principal: Principal, farm_id: str) -> None:
    if not principal.may_access_farm(farm_id):
        raise ForbiddenError("You do not have access to this farm.")


async def verify_device_key(x_device_key: Annotated[str | None, Header()] = None) -> None:
    """Shared-secret check for the ESP32 ingest endpoints.

    Ingest is refused outright when no key is configured — an open telemetry
    endpoint would let anyone write readings that look genuine.
    """
    if not settings.device_ingest_key:
        raise ServiceUnavailableError(
            "Device ingest is disabled because DEVICE_INGEST_KEY is not configured."
        )
    if not x_device_key or not hmac.compare_digest(x_device_key, settings.device_ingest_key):
        raise UnauthorisedError("Invalid device key.")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
