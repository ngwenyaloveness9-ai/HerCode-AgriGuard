"""Alert generation.

An alert is raised only when a measured value crosses a threshold that someone
configured. Each alert records both numbers, so an operator can always see what
was measured and what it was measured against.
"""

from __future__ import annotations

import logging

from app.models.domain import (
    Alert,
    AlertCategory,
    AlertSeverity,
    CropProfile,
    SensorType,
    Zone,
    ZoneEvaluation,
    ZoneStatus,
)
from app.repositories import entities
from app.services.evaluation import LatestReadings, now_utc

logger = logging.getLogger(__name__)

_STATUS_TO_ALERT: dict[ZoneStatus, tuple[AlertCategory, AlertSeverity, str]] = {
    ZoneStatus.CRITICAL_DRY: (AlertCategory.MOISTURE, AlertSeverity.CRITICAL, "Critical dryness"),
    ZoneStatus.DRY: (AlertCategory.MOISTURE, AlertSeverity.WARNING, "Below target moisture"),
    ZoneStatus.EXCESS_MOISTURE: (AlertCategory.WATER, AlertSeverity.WARNING, "Excess soil moisture"),
    ZoneStatus.HEAT_STRESS: (AlertCategory.HEAT, AlertSeverity.CRITICAL, "Heat stress"),
    ZoneStatus.SENSOR_ERROR: (AlertCategory.SENSOR, AlertSeverity.WARNING, "Sensor fault"),
    ZoneStatus.STALE_DATA: (AlertCategory.CONNECTIVITY, AlertSeverity.WARNING, "Telemetry has gone stale"),
    ZoneStatus.OFFLINE: (AlertCategory.CONNECTIVITY, AlertSeverity.CRITICAL, "Controller offline"),
}


def sync_zone_alerts(
    zone: Zone,
    evaluation: ZoneEvaluation,
    profile: CropProfile | None,
    system_response: str | None = None,
) -> Alert | None:
    """Raise or resolve the alert implied by a zone's current status.

    Deduplicated: an ongoing condition keeps one open alert rather than
    producing a new row on every reading.
    """
    mapping = _STATUS_TO_ALERT.get(evaluation.status)

    # Condition cleared — close anything still open for this zone.
    if mapping is None:
        for category in {entry[0] for entry in _STATUS_TO_ALERT.values()}:
            existing = entities.find_open_alert(zone.farm_id, zone.id, category)
            if existing is not None:
                entities.resolve_alert(existing.id, "system")
        return None

    category, severity, title = mapping

    if entities.find_open_alert(zone.farm_id, zone.id, category) is not None:
        return None

    alert = Alert(
        id="",
        farm_id=zone.farm_id,
        zone_id=zone.id,
        crop_type=zone.crop_type,
        category=category,
        severity=severity,
        title=f"{title} in {zone.name}",
        trigger=evaluation.reason or title,
        measured_value=evaluation.measured_value,
        configured_threshold=evaluation.configured_threshold,
        unit=evaluation.unit,
        system_response=system_response,
        timestamp=now_utc(),
    )
    return entities.create_alert(alert)


def check_reservoir_level(farm_id: str, level_percent: float | None, config) -> Alert | None:
    """Reservoir warnings fire only against configured levels."""
    if level_percent is None or config is None:
        return None

    critical = config.critical_level_percent
    low = config.low_level_percent

    if critical is not None and level_percent <= critical:
        severity, threshold, title = AlertSeverity.CRITICAL, critical, "Reservoir critically low"
    elif low is not None and level_percent <= low:
        severity, threshold, title = AlertSeverity.WARNING, low, "Reservoir low"
    else:
        existing = entities.find_open_alert(farm_id, None, AlertCategory.WATER)
        if existing is not None:
            entities.resolve_alert(existing.id, "system")
        return None

    if entities.find_open_alert(farm_id, None, AlertCategory.WATER) is not None:
        return None

    return entities.create_alert(
        Alert(
            id="",
            farm_id=farm_id,
            category=AlertCategory.WATER,
            severity=severity,
            title=title,
            trigger="Reservoir level crossed the configured threshold",
            measured_value=level_percent,
            configured_threshold=threshold,
            unit="%",
            timestamp=now_utc(),
        )
    )
