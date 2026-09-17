"""Telemetry reads, history, analytics and device ingest."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, require_farm_access, verify_device_key
from app.models.domain import (
    Bucket,
    ComparisonPeriod,
    ComparisonResult,
    SensorType,
    TelemetryIngest,
    TimeSeries,
)
from app.repositories import telemetry as telemetry_repo
from app.repositories.base import utcnow
from app.services import analytics, ingest

router = APIRouter(prefix="/api", tags=["telemetry"])


@router.get("/telemetry/latest")
def latest(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> dict:
    """Latest reading per sensor type.

    Sensor types with no stored reading are absent from the response rather
    than present with a zero.
    """
    require_farm_access(principal, farm_id)
    readings = telemetry_repo.get_latest_readings(farm_id, zone_id)
    return {
        sensor_type.value: reading.model_dump(by_alias=True)
        for sensor_type, reading in readings.items()
    }


@router.get("/telemetry/history", response_model=TimeSeries)
def history(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    sensor_type: SensorType = Query(alias="sensorType"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    zone_id: str | None = Query(default=None, alias="zoneId"),
    bucket: Bucket = Query(default=Bucket.RAW),
) -> TimeSeries:
    require_farm_access(principal, farm_id)
    end = to or utcnow()
    start = from_ or end - timedelta(days=1)
    return telemetry_repo.get_history(farm_id, sensor_type, start, end, zone_id, bucket)


@router.get("/analytics/comparison", response_model=ComparisonResult)
def comparison(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    metric: str = Query(),
    period: ComparisonPeriod = Query(),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> ComparisonResult:
    """Compare two windows of stored history.

    Returns ``sufficientData: false`` when either window is empty; it never
    fills a gap to make a comparison possible.
    """
    require_farm_access(principal, farm_id)
    result = analytics.compute_comparison(farm_id, metric, period, zone_id)
    if result.sufficient_data:
        analytics.cache_comparison(farm_id, metric, period.value, result, zone_id)
    return result


@router.post("/telemetry/ingest", dependencies=[Depends(verify_device_key)], status_code=202)
async def device_ingest(payload: TelemetryIngest) -> dict:
    """ESP32 telemetry intake.

    Authenticated by the shared device key, not a user token. Accepting the
    batch triggers re-evaluation, alerting and automation for that farm.
    """
    return await ingest.ingest(payload)
