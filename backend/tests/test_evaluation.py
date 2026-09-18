"""Tests for the rules that decide what a reading means.

These are the parts where a wrong answer waters an orchard incorrectly, so they
are tested against thresholds rather than against fixtures.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models.domain import (
    CropProfile,
    CropType,
    ReadingQuality,
    SensorReading,
    SensorType,
    Zone,
    ZoneStatus,
)
from app.services.evaluation import (
    evaluate_zone,
    is_stale,
    reservoir_litres,
    reservoir_percent,
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def reading(
    sensor_type: SensorType,
    value: float,
    *,
    age_seconds: int = 0,
    unit: str = "%",
    quality: ReadingQuality = ReadingQuality.GOOD,
) -> SensorReading:
    return SensorReading(
        id="r1",
        farm_id="farm1",
        zone_id="zoneA",
        sensor_id="s1",
        sensor_type=sensor_type,
        value=value,
        unit=unit,
        timestamp=now() - timedelta(seconds=age_seconds),
        quality=quality,
    )


def zone(crop: CropType = CropType.MACADAMIA) -> Zone:
    return Zone(
        id="zoneA",
        farm_id="farm1",
        name="Zone A",
        crop_type=crop,
        crop_profile_id="profile1",
    )


def profile(**overrides) -> CropProfile:
    base = {
        "id": "profile1",
        "farm_id": "farm1",
        "name": "Test profile",
        "crop_type": CropType.MACADAMIA,
    }
    return CropProfile(**{**base, **overrides})


# --------------------------------------------------------------------------- #
# Absence handling                                                              #
# --------------------------------------------------------------------------- #


def test_no_readings_is_unknown_not_normal():
    result = evaluate_zone(zone(), {}, profile(moisture_target_low=20, moisture_target_high=40))
    assert result.status == ZoneStatus.UNKNOWN
    assert result.reason == "No telemetry received yet"
    assert result.measured_value is None


def test_missing_profile_is_unknown_and_flagged():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 10)}
    result = evaluate_zone(zone(), readings, None)
    assert result.status == ZoneStatus.UNKNOWN
    assert result.profile_incomplete is True


def test_profile_without_thresholds_refuses_to_judge():
    """A reading plus an empty profile must not produce a health verdict."""
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 5)}
    result = evaluate_zone(zone(), readings, profile())
    assert result.status == ZoneStatus.UNKNOWN
    assert result.profile_incomplete is True


def test_offline_device_outranks_readings():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 30)}
    result = evaluate_zone(zone(), readings, profile(moisture_target_low=20, moisture_target_high=40), device_online=False)
    assert result.status == ZoneStatus.OFFLINE


# --------------------------------------------------------------------------- #
# Staleness                                                                     #
# --------------------------------------------------------------------------- #


def test_stale_reading_is_never_reported_as_healthy():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 30, age_seconds=10_000)}
    result = evaluate_zone(zone(), readings, profile(moisture_target_low=20, moisture_target_high=40))
    assert result.status == ZoneStatus.STALE_DATA


def test_is_stale_boundary():
    assert is_stale(now() - timedelta(seconds=10)) is False
    assert is_stale(now() - timedelta(hours=2)) is True
    assert is_stale(None) is False


# --------------------------------------------------------------------------- #
# Thresholds                                                                    #
# --------------------------------------------------------------------------- #


def test_critical_dry_reports_both_numbers():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 8)}
    result = evaluate_zone(zone(), readings, profile(moisture_critical_low=10, moisture_target_low=20))
    assert result.status == ZoneStatus.CRITICAL_DRY
    assert result.measured_value == 8
    assert result.configured_threshold == 10


def test_dry_is_below_target_but_above_critical():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 15)}
    result = evaluate_zone(
        zone(), readings, profile(moisture_critical_low=10, moisture_target_low=20, moisture_target_high=40)
    )
    assert result.status == ZoneStatus.DRY


def test_normal_requires_a_full_configured_range():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 30)}
    # Only a low bound configured: not enough to call the zone normal.
    partial = evaluate_zone(zone(), readings, profile(moisture_target_low=20))
    assert partial.status == ZoneStatus.UNKNOWN

    full = evaluate_zone(zone(), readings, profile(moisture_target_low=20, moisture_target_high=40))
    assert full.status == ZoneStatus.NORMAL


def test_waterlogging_detected_for_macadamia():
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 55)}
    result = evaluate_zone(
        zone(), readings, profile(moisture_target_low=20, moisture_target_high=40, moisture_excess_high=50)
    )
    assert result.status == ZoneStatus.EXCESS_MOISTURE


def test_heat_stress_uses_configured_critical_high():
    readings = {
        SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 30),
        SensorType.AMBIENT_TEMPERATURE: reading(SensorType.AMBIENT_TEMPERATURE, 39, unit="°C"),
    }
    result = evaluate_zone(
        zone(),
        readings,
        profile(moisture_target_low=20, moisture_target_high=40, temperature_critical_high=38),
    )
    assert result.status == ZoneStatus.HEAT_STRESS
    assert result.configured_threshold == 38


def test_heat_without_configured_threshold_does_not_alarm():
    readings = {
        SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 30),
        SensorType.AMBIENT_TEMPERATURE: reading(SensorType.AMBIENT_TEMPERATURE, 45, unit="°C"),
    }
    result = evaluate_zone(zone(), readings, profile(moisture_target_low=20, moisture_target_high=40))
    assert result.status == ZoneStatus.NORMAL


def test_bad_quality_reading_is_a_sensor_error():
    readings = {
        SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 2, quality=ReadingQuality.BAD)
    }
    result = evaluate_zone(zone(), readings, profile(moisture_critical_low=10))
    assert result.status == ZoneStatus.SENSOR_ERROR


def test_macadamia_and_citrus_use_their_own_profiles():
    """The same reading yields different verdicts under different profiles."""
    readings = {SensorType.SOIL_MOISTURE: reading(SensorType.SOIL_MOISTURE, 22)}

    mac = evaluate_zone(
        zone(CropType.MACADAMIA),
        readings,
        profile(crop_type=CropType.MACADAMIA, moisture_target_low=25, moisture_target_high=40),
    )
    cit = evaluate_zone(
        zone(CropType.CITRUS),
        readings,
        profile(crop_type=CropType.CITRUS, moisture_target_low=18, moisture_target_high=35),
    )

    assert mac.status == ZoneStatus.DRY
    assert cit.status == ZoneStatus.NORMAL


# --------------------------------------------------------------------------- #
# Reservoir maths                                                               #
# --------------------------------------------------------------------------- #


def test_reservoir_percent_needs_configured_geometry():
    assert reservoir_percent(40.0, None, None) is None
    assert reservoir_percent(None, 100.0, 0.0) is None


def test_reservoir_percent_and_litres():
    # 100 cm tank, sensor reads 25 cm of air above the water: 75% full.
    percent = reservoir_percent(25.0, 100.0, 0.0)
    assert percent == pytest.approx(75.0)
    assert reservoir_litres(percent, 5000.0) == pytest.approx(3750.0)


def test_litres_require_a_configured_capacity():
    assert reservoir_litres(75.0, None) is None


def test_reservoir_percent_is_clamped():
    assert reservoir_percent(-20.0, 100.0, 0.0) == 100.0
    assert reservoir_percent(200.0, 100.0, 0.0) == 0.0
