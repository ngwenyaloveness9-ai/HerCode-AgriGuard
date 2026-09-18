"""Period comparisons.

Both windows are read from stored history. When either is empty the result is
returned with ``sufficient_data=False`` and no numbers, which is what the
frontend renders as "Insufficient historical data for comparison."
"""

from __future__ import annotations

from datetime import datetime

from app.firebase.client import Collections
from app.models.domain import ComparisonPeriod, ComparisonResult, SensorType
from app.repositories import operations, telemetry
from app.repositories.base import db, utcnow

DERIVED_METRICS = {"WATER_VOLUME", "IRRIGATION_DURATION", "IRRIGATION_COUNT"}


def compute_comparison(
    farm_id: str,
    metric: str,
    period: ComparisonPeriod,
    zone_id: str | None = None,
    reference: datetime | None = None,
) -> ComparisonResult:
    now = reference or utcnow()
    current_start, current_end, previous_start, previous_end = telemetry.window_for(
        period.value if isinstance(period, ComparisonPeriod) else period, now
    )

    if metric in DERIVED_METRICS:
        current, unit = _irrigation_metric(farm_id, metric, current_start, current_end, zone_id)
        previous, _ = _irrigation_metric(farm_id, metric, previous_start, previous_end, zone_id)
    else:
        try:
            sensor_type = SensorType(metric)
        except ValueError:
            return ComparisonResult(metric=metric, unit="", sufficient_data=False)
        current, unit = telemetry.sum_over_window(farm_id, sensor_type, current_start, current_end, zone_id)
        previous, _ = telemetry.sum_over_window(farm_id, sensor_type, previous_start, previous_end, zone_id)

    if current is None or previous is None:
        return ComparisonResult(metric=metric, unit=unit or "", sufficient_data=False)

    absolute = current - previous
    percentage = (absolute / abs(previous) * 100.0) if previous != 0 else None
    trend = "UP" if absolute > 0 else "DOWN" if absolute < 0 else "FLAT"

    return ComparisonResult(
        metric=metric,
        unit=unit or "",
        current_value=current,
        previous_value=previous,
        absolute_difference=absolute,
        percentage_difference=percentage,
        trend=trend,
        sufficient_data=True,
    )


def _irrigation_metric(
    farm_id: str, metric: str, start: datetime, end: datetime, zone_id: str | None
) -> tuple[float | None, str]:
    events = operations.list_irrigation_events(farm_id, zone_id=zone_id, start=start, end=end, limit=1000)
    if not events:
        return None, ""

    if metric == "IRRIGATION_COUNT":
        return float(len(events)), "events"

    if metric == "IRRIGATION_DURATION":
        durations = [e.duration_seconds for e in events if e.duration_seconds is not None]
        return (sum(durations) / 60.0, "min") if durations else (None, "min")

    volumes = [e.volume_litres for e in events if e.volume_litres is not None]
    # Volume is reported only when the flow meter actually recorded it.
    return (sum(volumes), "L") if volumes else (None, "L")


def cache_comparison(farm_id: str, metric: str, period: str, result: ComparisonResult, zone_id: str | None) -> None:
    """Store the aggregate so a direct-to-Firestore client can read it too."""
    doc_id = f"{farm_id}__{zone_id or 'farm'}__{metric}__{period}"
    db().collection(Collections.COMPARISONS).document(doc_id).set(
        {
            "farmId": farm_id,
            "zoneId": zone_id,
            "metric": metric,
            "period": period,
            "currentValue": result.current_value,
            "previousValue": result.previous_value,
            "unit": result.unit,
            "computedAt": utcnow(),
        },
        merge=True,
    )
