"""Telemetry storage and retrieval."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.firebase.client import Collections
from app.models.domain import (
    Bucket,
    ReadingQuality,
    ReadingSource,
    SensorReading,
    SensorType,
    TimeSeries,
    TimeSeriesPoint,
)
from app.repositories.base import db, snapshot_data, to_datetime, to_float

logger = logging.getLogger(__name__)

LatestReadings = dict[SensorType, SensorReading]


def _map_reading(data: dict[str, Any], doc_id: str) -> SensorReading | None:
    """A reading without a value, a timestamp or a type is not a reading."""
    value = to_float(data.get("value"))
    timestamp = to_datetime(data.get("timestamp"))
    sensor_type = data.get("sensorType")

    if value is None or timestamp is None or sensor_type not in {s.value for s in SensorType}:
        logger.debug("Discarding malformed reading %s", doc_id)
        return None

    return SensorReading(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=str(data["zoneId"]) if data.get("zoneId") else None,
        sensor_id=str(data.get("sensorId") or ""),
        sensor_type=SensorType(sensor_type),
        value=value,
        unit=str(data.get("unit") or ""),
        timestamp=timestamp,
        quality=ReadingQuality(data.get("quality") or ReadingQuality.GOOD.value),
        source=ReadingSource(data.get("source") or ReadingSource.ESP32.value),
    )


def _latest_doc_id(farm_id: str, zone_id: str | None, sensor_type: SensorType) -> str:
    return f"{farm_id}__{zone_id or 'farm'}__{sensor_type.value}"


def write_reading(reading: SensorReading) -> SensorReading:
    """Append to history and upsert the latest-value document in one batch."""
    payload = {
        "farmId": reading.farm_id,
        "zoneId": reading.zone_id,
        "sensorId": reading.sensor_id,
        "sensorType": reading.sensor_type.value
        if isinstance(reading.sensor_type, SensorType)
        else reading.sensor_type,
        "value": reading.value,
        "unit": reading.unit,
        "timestamp": reading.timestamp,
        "quality": reading.quality,
        "source": reading.source,
    }

    batch = db().batch()
    history_ref = db().collection(Collections.SENSOR_READINGS).document()
    batch.set(history_ref, payload)

    latest_ref = db().collection(Collections.LATEST_READINGS).document(
        _latest_doc_id(reading.farm_id, reading.zone_id, SensorType(payload["sensorType"]))
    )
    batch.set(latest_ref, payload, merge=True)
    batch.commit()

    return reading.model_copy(update={"id": history_ref.id})


def get_latest_readings(farm_id: str, zone_id: str | None = None) -> LatestReadings:
    query = (
        db()
        .collection(Collections.LATEST_READINGS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
    )
    if zone_id:
        query = query.where(filter=FieldFilter("zoneId", "==", zone_id))

    latest: LatestReadings = {}
    for doc in query.stream():
        reading = _map_reading(snapshot_data(doc), doc.id)
        if reading is None:
            continue
        existing = latest.get(reading.sensor_type)
        if existing is None or reading.timestamp > existing.timestamp:
            latest[reading.sensor_type] = reading
    return latest


def get_latest_readings_by_zone(farm_id: str) -> dict[str, LatestReadings]:
    """Latest readings grouped by zone, for farm-wide evaluation in one query."""
    query = (
        db()
        .collection(Collections.LATEST_READINGS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
    )
    grouped: dict[str, LatestReadings] = {}
    for doc in query.stream():
        reading = _map_reading(snapshot_data(doc), doc.id)
        if reading is None or reading.zone_id is None:
            continue
        bucket = grouped.setdefault(reading.zone_id, {})
        existing = bucket.get(reading.sensor_type)
        if existing is None or reading.timestamp > existing.timestamp:
            bucket[reading.sensor_type] = reading
    return grouped


def get_history(
    farm_id: str,
    sensor_type: SensorType,
    start: datetime,
    end: datetime,
    zone_id: str | None = None,
    bucket: Bucket = Bucket.RAW,
    limit: int = 5000,
) -> TimeSeries:
    query = (
        db()
        .collection(Collections.SENSOR_READINGS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
        .where(filter=FieldFilter("sensorType", "==", sensor_type.value))
        .where(filter=FieldFilter("timestamp", ">=", start))
        .where(filter=FieldFilter("timestamp", "<=", end))
    )
    if zone_id:
        query = query.where(filter=FieldFilter("zoneId", "==", zone_id))

    readings: list[SensorReading] = []
    for doc in query.order_by("timestamp").limit(limit).stream():
        mapped = _map_reading(snapshot_data(doc), doc.id)
        if mapped is not None:
            readings.append(mapped)

    points = [TimeSeriesPoint(timestamp=r.timestamp, value=r.value) for r in readings]
    if bucket is not Bucket.RAW:
        points = bucket_points(points, bucket)

    return TimeSeries(
        sensor_type=sensor_type,
        zone_id=zone_id,
        unit=readings[0].unit if readings else "",
        points=points,
    )


def bucket_points(points: list[TimeSeriesPoint], bucket: Bucket) -> list[TimeSeriesPoint]:
    """Average points into hour, day or month buckets. Empty stays empty."""
    if not points:
        return []

    groups: dict[datetime, list[float]] = {}
    for point in points:
        ts = point.timestamp
        if bucket is Bucket.HOUR:
            key = ts.replace(minute=0, second=0, microsecond=0)
        elif bucket is Bucket.DAY:
            key = ts.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            key = ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        groups.setdefault(key, []).append(point.value)

    return [
        TimeSeriesPoint(timestamp=key, value=sum(values) / len(values))
        for key, values in sorted(groups.items())
    ]


def sum_over_window(
    farm_id: str,
    sensor_type: SensorType,
    start: datetime,
    end: datetime,
    zone_id: str | None = None,
) -> tuple[float | None, str]:
    """Mean of stored readings in a window, or None when the window is empty."""
    series = get_history(farm_id, sensor_type, start, end, zone_id=zone_id)
    if not series.points:
        return None, series.unit
    return sum(p.value for p in series.points) / len(series.points), series.unit


def window_for(period: str, reference: datetime) -> tuple[datetime, datetime, datetime, datetime]:
    """Current and previous window bounds for a comparison period."""
    day_start = reference.replace(hour=0, minute=0, second=0, microsecond=0)

    if period in {"TODAY", "DAY"}:
        return day_start, reference, day_start - timedelta(days=1), day_start
    if period == "WEEK":
        week_start = day_start - timedelta(days=day_start.weekday())
        return week_start, reference, week_start - timedelta(days=7), week_start
    if period == "MONTH":
        month_start = day_start.replace(day=1)
        previous_end = month_start
        previous_start = (month_start - timedelta(days=1)).replace(day=1)
        return month_start, reference, previous_start, previous_end
    year_start = day_start.replace(month=1, day=1)
    return year_start, reference, year_start.replace(year=year_start.year - 1), year_start
