"""Devices, system health, alerts, automation, users and reports."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Response

from app.config import settings
from app.core.errors import ValidationError
from app.core.security import CurrentUser, Permission, Principal, require, require_farm_access
from app.models.domain import (
    Alert,
    AutomationRule,
    Device,
    DeviceHealth,
    DeviceStatus,
    SystemHealth,
    User,
    UserRole,
)
from app.realtime.events import Events, emit
from app.repositories import entities, operations, telemetry
from app.repositories.base import utcnow
from app.services import analytics

router = APIRouter(prefix="/api", tags=["devices"])


# --------------------------------------------------------------------------- #
# Devices and health                                                            #
# --------------------------------------------------------------------------- #


@router.get("/devices", response_model=list[Device])
def list_devices(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[Device]:
    require_farm_access(principal, farm_id)
    return _with_freshness(entities.list_devices(farm_id))


@router.get("/devices/{device_id}", response_model=Device)
def get_device(device_id: str, principal: CurrentUser) -> Device:
    device = entities.get_device(device_id)
    require_farm_access(principal, device.farm_id)
    return _with_freshness([device])[0]


def _with_freshness(devices: list[Device]) -> list[Device]:
    """Downgrade a device that has stopped reporting.

    A stored ONLINE flag is not evidence of being online now — it is evidence of
    having been online when it was written.
    """
    cutoff = utcnow() - timedelta(seconds=settings.stale_data_seconds * 3)
    resolved: list[Device] = []
    for device in devices:
        if device.status == DeviceStatus.ONLINE and (device.last_seen is None or device.last_seen < cutoff):
            resolved.append(device.model_copy(update={"status": DeviceStatus.OFFLINE}))
        else:
            resolved.append(device)
    return resolved


@router.get("/system-health", response_model=SystemHealth)
def system_health(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> SystemHealth:
    """Component health assembled from device heartbeats.

    A device that has never been seen is UNKNOWN. Nothing is reported ONLINE
    without a recent heartbeat behind it.
    """
    require_farm_access(principal, farm_id)

    stored = entities.get_system_health(farm_id)
    devices = _with_freshness(entities.list_devices(farm_id))

    components = [
        DeviceHealth(
            device_id=device.name or device.id,
            status=device.status,
            last_seen=device.last_seen,
            message=None if device.last_seen else "No heartbeat received",
        )
        for device in devices
    ]

    return SystemHealth(
        components=components or (stored.components if stored else []),
        backend=DeviceStatus.ONLINE,  # this response is proof the backend is up
        database=DeviceStatus.ONLINE,  # reached Firestore to build the list above
        network=stored.network if stored else DeviceStatus.UNKNOWN,
        reported_at=utcnow(),
    )


# --------------------------------------------------------------------------- #
# Alerts                                                                        #
# --------------------------------------------------------------------------- #


@router.get("/alerts", response_model=list[Alert])
def list_alerts(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    resolved: bool | None = Query(default=None),
    limit: int = Query(default=200, le=500),
) -> list[Alert]:
    require_farm_access(principal, farm_id)
    return entities.list_alerts(farm_id, resolved, limit)


@router.post("/alerts/{alert_id}/resolve", response_model=Alert)
async def resolve_alert(alert_id: str, principal: CurrentUser) -> Alert:
    alert = entities.resolve_alert(alert_id, principal.uid)
    await emit(Events.ALERT_RESOLVED, alert.farm_id, {"alertId": alert.id})
    return alert


# --------------------------------------------------------------------------- #
# Automation                                                                    #
# --------------------------------------------------------------------------- #


@router.get("/automation", response_model=list[AutomationRule])
def list_rules(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[AutomationRule]:
    require_farm_access(principal, farm_id)
    return entities.list_automation_rules(farm_id)


@router.put("/automation/{rule_id}", response_model=AutomationRule)
def save_rule(
    rule_id: str,
    payload: AutomationRule,
    principal: Principal = Depends(require(Permission.EDIT_AUTOMATION)),
) -> AutomationRule:
    """Rules that move equipment are validated before they are stored."""
    require_farm_access(principal, payload.farm_id)

    if payload.max_runtime_minutes is not None and payload.max_runtime_minutes <= 0:
        raise ValidationError("Maximum runtime must be greater than zero.")
    if payload.recovery_threshold is None and payload.max_runtime_minutes is None:
        raise ValidationError(
            "A rule needs either a recovery threshold or a maximum runtime, "
            "otherwise nothing would stop it."
        )

    saved = entities.save_automation_rule(payload.model_copy(update={"id": rule_id}))
    entities.write_audit_log(
        payload.farm_id, principal.uid, "automation.save", rule_id, {"enabled": payload.enabled}
    )
    return saved


@router.delete("/automation/{rule_id}", status_code=204, response_class=Response)
def delete_rule(
    rule_id: str, principal: Principal = Depends(require(Permission.EDIT_AUTOMATION))
) -> Response:
    entities.delete_automation_rule(rule_id)
    return Response(status_code=204)


# --------------------------------------------------------------------------- #
# Users                                                                         #
# --------------------------------------------------------------------------- #


@router.get("/users", response_model=list[User])
def list_users(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[User]:
    require_farm_access(principal, farm_id)
    return entities.list_users(farm_id)


@router.get("/users/{user_id}", response_model=User)
def get_user(user_id: str, principal: CurrentUser) -> User:
    if user_id != principal.uid and not principal.has(Permission.MANAGE_USERS):
        from app.core.errors import ForbiddenError

        raise ForbiddenError("You may only view your own profile.")
    return entities.get_user(user_id)


@router.patch("/users/{user_id}/role", response_model=User)
def set_role(
    user_id: str,
    role: UserRole,
    principal: Principal = Depends(require(Permission.MANAGE_USERS)),
) -> User:
    return entities.set_user_role(user_id, role)


# --------------------------------------------------------------------------- #
# Reports                                                                       #
# --------------------------------------------------------------------------- #


@router.get("/reports/{report_type}")
def generate_report(
    report_type: str,
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
) -> dict:
    """Reports are assembled from stored records only.

    Sections whose underlying data is absent are returned as ``None`` with a
    note, so a report never contains a figure nobody measured.
    """
    require_farm_access(principal, farm_id)

    end = to or utcnow()
    start = from_ or end - timedelta(days=1)

    events = operations.list_irrigation_events(farm_id, start=start, end=end, limit=1000)
    alerts = [a for a in entities.list_alerts(farm_id, limit=500) if start <= a.timestamp <= end]

    volumes = [e.volume_litres for e in events if e.volume_litres is not None]
    durations = [e.duration_seconds for e in events if e.duration_seconds is not None]

    return {
        "reportType": report_type,
        "farmId": farm_id,
        "from": start,
        "to": end,
        "generatedAt": utcnow(),
        "irrigation": {
            "eventCount": len(events),
            "totalVolumeLitres": sum(volumes) if volumes else None,
            "totalDurationSeconds": sum(durations) if durations else None,
            "note": None if volumes else "No flow-meter volumes were recorded in this period.",
        },
        "alerts": {
            "total": len(alerts),
            "critical": len([a for a in alerts if a.severity == "CRITICAL"]),
            "unresolved": len([a for a in alerts if a.resolved_at is None]),
        },
        "zones": [
            {"zoneId": z.id, "name": z.name, "cropType": z.crop_type, "status": z.status}
            for z in entities.list_zones(farm_id)
        ],
    }
