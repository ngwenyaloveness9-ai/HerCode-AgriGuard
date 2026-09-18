"""Firebase Admin initialisation and Firestore access.

Credentials come from a service-account file or inline JSON. Nothing is
committed and no default project is assumed.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client as FirestoreClient

from app.config import settings

logger = logging.getLogger(__name__)


class FirebaseNotConfigured(RuntimeError):
    """Raised when Firebase credentials are missing.

    The API surfaces this as 503 rather than returning empty results, so a
    misconfigured deployment never looks like a farm without sensors.
    """


def _build_credentials() -> credentials.Base:
    if settings.firebase_credentials_json:
        try:
            payload = json.loads(settings.firebase_credentials_json)
        except json.JSONDecodeError as exc:  # pragma: no cover - configuration error
            raise FirebaseNotConfigured("FIREBASE_CREDENTIALS_JSON is not valid JSON") from exc
        return credentials.Certificate(payload)

    if settings.google_application_credentials:
        return credentials.Certificate(settings.google_application_credentials)

    # Falls back to workload identity on Google infrastructure.
    return credentials.ApplicationDefault()


@lru_cache
def get_app() -> firebase_admin.App:
    if firebase_admin._apps:  # noqa: SLF001 - the SDK exposes no public accessor
        return firebase_admin.get_app()
    try:
        options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
        return firebase_admin.initialize_app(_build_credentials(), options)
    except Exception as exc:
        raise FirebaseNotConfigured(f"Firebase could not be initialised: {exc}") from exc


@lru_cache
def get_db() -> FirestoreClient:
    return firestore.client(get_app())


def get_auth():
    get_app()
    return firebase_auth


def firebase_ready() -> bool:
    try:
        get_app()
    except FirebaseNotConfigured:
        return False
    return True


class Collections:
    """Collection names in one place so the schema stays auditable."""

    USERS = "users"
    FARMS = "farms"
    FIELDS = "fields"
    ZONES = "zones"
    CROP_PROFILES = "cropProfiles"
    DEVICES = "devices"
    SENSORS = "sensors"
    SENSOR_READINGS = "sensorReadings"
    LATEST_READINGS = "latestReadings"
    IRRIGATION_EVENTS = "irrigationEvents"
    SHADE_EVENTS = "shadeEvents"
    RESERVOIR_READINGS = "reservoirReadings"
    RESERVOIR_CONFIG = "reservoirConfig"
    FLOW_READINGS = "flowReadings"
    SOLAR_READINGS = "solarReadings"
    BATTERY_READINGS = "batteryReadings"
    ALERTS = "alerts"
    SYSTEM_HEALTH = "systemHealth"
    AUTOMATION_RULES = "automationRules"
    COMMANDS = "commands"
    AUDIT_LOGS = "auditLogs"
    COMPARISONS = "comparisons"
