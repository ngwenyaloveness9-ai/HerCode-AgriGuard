"""Zone evaluation.

This is the authoritative copy of the rules the frontend also applies, so a
screen and a stored status can never disagree about what a reading means.

Two invariants hold throughout:

1. A status is produced only from a reading that exists and a threshold that has
   been configured. A missing threshold is never replaced with a literature
   value for macadamia or citrus — the condition is simply not judged.
2. Staleness outranks agronomy. An old number is not a current one, however
   healthy it looks.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.models.domain import (
    CropProfile,
    ReadingQuality,
    SensorReading,
    SensorType,
    Zone,
    ZoneEvaluation,
    ZoneStatus,
)

LatestReadings = dict[SensorType, SensorReading]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_stale(timestamp: datetime | None, now: datetime | None = None) -> bool:
    if timestamp is None:
        return False
    reference = now or now_utc()
    return reference - _aware(timestamp) > timedelta(seconds=settings.stale_data_seconds)


def newest_reading(readings: LatestReadings) -> SensorReading | None:
    candidates = [r for r in readings.values() if r is not None]
    if not candidates:
        return None
    return max(candidates, key=lambda r: _aware(r.timestamp))


def evaluate_zone(
    zone: Zone,
    readings: LatestReadings,
    profile: CropProfile | None,
    device_online: bool | None = None,
    now: datetime | None = None,
) -> ZoneEvaluation:
    """Return the zone's status together with the evidence that produced it."""

    reference = now or now_utc()
    newest = newest_reading(readings)

    if device_online is False:
        return ZoneEvaluation(
            zone_id=zone.id,
            status=ZoneStatus.OFFLINE,
            reason="Controller is not reporting",
            last_reading_at=newest.timestamp if newest else None,
        )

    if newest is None:
        return ZoneEvaluation(
            zone_id=zone.id,
            status=ZoneStatus.UNKNOWN,
            reason="No telemetry received yet",
        )

    if is_stale(newest.timestamp, reference):
        return ZoneEvaluation(
            zone_id=zone.id,
            status=ZoneStatus.STALE_DATA,
            reason="Last reading is older than the configured stale-data interval",
            last_reading_at=newest.timestamp,
        )

    moisture = readings.get(SensorType.SOIL_MOISTURE)
    soil_temp = readings.get(SensorType.SOIL_TEMPERATURE)
    ambient = readings.get(SensorType.AMBIENT_TEMPERATURE)

    bad = [r for r in (moisture, soil_temp) if r is not None and r.quality == ReadingQuality.BAD]
    if bad:
        return ZoneEvaluation(
            zone_id=zone.id,
            status=ZoneStatus.SENSOR_ERROR,
            reason="Sensor reported a bad-quality reading",
            last_reading_at=newest.timestamp,
        )

    if profile is None:
        return ZoneEvaluation(
            zone_id=zone.id,
            status=ZoneStatus.UNKNOWN,
            reason=f"No crop profile assigned to {zone.name}",
            profile_incomplete=True,
            last_reading_at=newest.timestamp,
        )

    common = {"zone_id": zone.id, "last_reading_at": newest.timestamp}

    # 1. Critical dryness takes precedence over everything else measurable.
    if moisture is not None and profile.moisture_critical_low is not None:
        if moisture.value <= profile.moisture_critical_low:
            return ZoneEvaluation(
                **common,
                status=ZoneStatus.CRITICAL_DRY,
                reason="Root-zone moisture is at or below the configured critical threshold",
                measured_value=moisture.value,
                configured_threshold=profile.moisture_critical_low,
                unit=moisture.unit,
            )

    # 2. Heat stress. Soil temperature is preferred; ambient is the fallback.
    heat = soil_temp or ambient
    if heat is not None and profile.temperature_critical_high is not None:
        if heat.value >= profile.temperature_critical_high:
            return ZoneEvaluation(
                **common,
                status=ZoneStatus.HEAT_STRESS,
                reason="Temperature is at or above the configured critical threshold",
                measured_value=heat.value,
                configured_threshold=profile.temperature_critical_high,
                unit=heat.unit,
            )

    # 3. Waterlogging risk — as dangerous as dryness for macadamia.
    if moisture is not None and profile.moisture_excess_high is not None:
        if moisture.value >= profile.moisture_excess_high:
            return ZoneEvaluation(
                **common,
                status=ZoneStatus.EXCESS_MOISTURE,
                reason="Root-zone moisture is at or above the configured excess threshold",
                measured_value=moisture.value,
                configured_threshold=profile.moisture_excess_high,
                unit=moisture.unit,
            )

    # 4. Dry but not yet critical.
    if moisture is not None and profile.moisture_target_low is not None:
        if moisture.value < profile.moisture_target_low:
            return ZoneEvaluation(
                **common,
                status=ZoneStatus.DRY,
                reason="Root-zone moisture is below the configured target range",
                measured_value=moisture.value,
                configured_threshold=profile.moisture_target_low,
                unit=moisture.unit,
            )

    # 5. Normal — claimed only when a full target range was configured.
    if (
        moisture is not None
        and profile.moisture_target_low is not None
        and profile.moisture_target_high is not None
    ):
        return ZoneEvaluation(
            **common,
            status=ZoneStatus.NORMAL,
            reason="Root-zone moisture is inside the configured target range",
            measured_value=moisture.value,
            configured_threshold=profile.moisture_target_low,
            unit=moisture.unit,
        )

    return ZoneEvaluation(
        **common,
        status=ZoneStatus.UNKNOWN,
        reason="Crop profile does not define the thresholds needed to evaluate this zone",
        profile_incomplete=True,
    )


def reservoir_percent(distance_cm: float | None, height_cm: float | None, offset_cm: float | None) -> float | None:
    """Convert an ultrasonic distance into a fill percentage.

    Returns None unless the reservoir geometry has been configured, because
    without a height the distance says nothing about how full the tank is.
    """
    if distance_cm is None or height_cm is None or height_cm <= 0:
        return None
    water_column = height_cm - (distance_cm - (offset_cm or 0.0))
    percent = (water_column / height_cm) * 100.0
    return max(0.0, min(100.0, percent))


def reservoir_litres(percent: float | None, capacity_litres: float | None) -> float | None:
    """Litres are only ever derived when a capacity has been configured."""
    if percent is None or capacity_litres is None:
        return None
    return (percent / 100.0) * capacity_litres
