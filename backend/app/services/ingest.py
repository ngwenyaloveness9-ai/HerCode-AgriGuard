"""Telemetry ingest.

This is the one path by which a reading enters the system, and everything
downstream is a consequence of it:

    store → re-evaluate every affected zone → sync alerts → run automation
          → broadcast to subscribers

Readings are stored exactly as the device reported them. No value is smoothed,
back-filled or interpolated, so a gap in the data stays a visible gap.
"""

from __future__ import annotations

import logging

from app.models.domain import (
    BatteryReading,
    FlowReading,
    ReadingSource,
    ReservoirReading,
    SensorReading,
    SensorType,
    SolarReading,
    TelemetryIngest,
    Zone,
    ZoneEvaluation,
)
from app.realtime.events import Events, emit
from app.repositories import entities, operations, telemetry
from app.repositories.base import utcnow
from app.services import alerts as alert_service
from app.services import automation
from app.services.evaluation import evaluate_zone, reservoir_litres, reservoir_percent

logger = logging.getLogger(__name__)


async def ingest(payload: TelemetryIngest) -> dict:
    """Process one batch from a device and return a summary of what happened."""

    stored: list[SensorReading] = []
    now = utcnow()

    for item in payload.readings:
        reading = SensorReading(
            id="",
            farm_id=payload.farm_id,
            zone_id=item.zone_id,
            sensor_id=item.sensor_id,
            sensor_type=item.sensor_type,
            value=item.value,
            unit=item.unit,
            # The device's own timestamp wins; arrival time is the fallback.
            timestamp=item.timestamp or now,
            quality=item.quality,
            source=ReadingSource.ESP32,
        )
        stored.append(telemetry.write_reading(reading))
        _mirror_specialised(payload.farm_id, reading)

    entities.touch_device(payload.device_id, payload.farm_id, now)

    evaluations = await _reevaluate_farm(payload.farm_id)

    await emit(
        Events.TELEMETRY_UPDATE,
        payload.farm_id,
        {"farmId": payload.farm_id, "deviceId": payload.device_id, "count": len(stored)},
    )
    await emit(Events.DEVICE_STATUS, payload.farm_id, {"deviceId": payload.device_id, "status": "ONLINE"})

    return {
        "accepted": len(stored),
        "zonesEvaluated": len(evaluations),
        "statuses": {e.zone_id: e.status for e in evaluations},
    }


def _mirror_specialised(farm_id: str, reading: SensorReading) -> None:
    """Fan reservoir, flow and energy readings into their own collections.

    The reservoir percentage is derived only when the tank geometry has been
    configured; litres only when a capacity has been. Otherwise the distance is
    stored on its own and the UI reports the level as unavailable.
    """
    sensor_type = SensorType(reading.sensor_type)

    if sensor_type is SensorType.RESERVOIR_LEVEL:
        config = operations.get_reservoir_config(farm_id)
        if reading.unit.lower() in {"cm", "mm"}:
            distance = reading.value if reading.unit.lower() == "cm" else reading.value / 10
            percent = reservoir_percent(
                distance,
                config.height_cm if config else None,
                config.sensor_offset_cm if config else None,
            )
        else:
            distance, percent = None, reading.value

        litres = reservoir_litres(percent, config.capacity_litres if config else None)
        operations.write_reservoir_reading(
            ReservoirReading(
                id="",
                farm_id=farm_id,
                level_percent=percent,
                distance_cm=distance,
                estimated_litres=litres,
                timestamp=reading.timestamp,
                quality=reading.quality,
            )
        )
        alert_service.check_reservoir_level(farm_id, percent, config)

    elif sensor_type is SensorType.FLOW:
        operations.write_flow_reading(
            FlowReading(
                id="",
                farm_id=farm_id,
                zone_id=reading.zone_id,
                litres_per_minute=reading.value,
                timestamp=reading.timestamp,
            )
        )

    elif sensor_type in {SensorType.SOLAR_VOLTAGE, SensorType.SOLAR_CURRENT}:
        operations.write_solar_reading(
            SolarReading(
                id="",
                farm_id=farm_id,
                voltage=reading.value if sensor_type is SensorType.SOLAR_VOLTAGE else None,
                current=reading.value if sensor_type is SensorType.SOLAR_CURRENT else None,
                timestamp=reading.timestamp,
            )
        )

    elif sensor_type in {SensorType.BATTERY_VOLTAGE, SensorType.BATTERY_PERCENT}:
        operations.write_battery_reading(
            BatteryReading(
                id="",
                farm_id=farm_id,
                voltage=reading.value if sensor_type is SensorType.BATTERY_VOLTAGE else None,
                percent=reading.value if sensor_type is SensorType.BATTERY_PERCENT else None,
                timestamp=reading.timestamp,
            )
        )


async def _reevaluate_farm(farm_id: str) -> list[ZoneEvaluation]:
    zones = entities.list_zones(farm_id)
    if not zones:
        return []

    profiles = entities.profiles_by_id(farm_id)
    readings_by_zone = telemetry.get_latest_readings_by_zone(farm_id)
    zone_map: dict[str, Zone] = {zone.id: zone for zone in zones}

    evaluations: list[ZoneEvaluation] = []
    for zone in zones:
        profile = profiles.get(zone.crop_profile_id) if zone.crop_profile_id else None
        evaluation = evaluate_zone(zone, readings_by_zone.get(zone.id, {}), profile)
        evaluations.append(evaluation)

        if evaluation.status != zone.status:
            entities.set_zone_status(zone.id, evaluation.status, evaluation.last_reading_at or utcnow())
            await emit(
                Events.ZONE_UPDATE,
                farm_id,
                {"zoneId": zone.id, "status": evaluation.status, "reason": evaluation.reason},
            )

        alert = alert_service.sync_zone_alerts(zone, evaluation, profile)
        if alert is not None:
            await emit(Events.ALERT_NEW, farm_id, {"alertId": alert.id, "severity": alert.severity})

    try:
        automation.evaluate_rules(farm_id, zone_map, readings_by_zone)
    except Exception as exc:  # pragma: no cover - automation must not break ingest
        logger.exception("Automation evaluation failed for farm %s: %s", farm_id, exc)

    return evaluations
