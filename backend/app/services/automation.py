"""Automation engine.

Rules run server-side after each telemetry batch. Safety comes first: a rule is
skipped rather than guessed at whenever anything it depends on is missing —
an absent reading, an unconfigured recovery threshold, an unknown reservoir
level, or a sensor reporting bad quality.

The engine queues commands. It never marks equipment as running; only the
device's own acknowledgement does that.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from app.models.domain import (
    ActuatorAction,
    AutomationRule,
    IrrigationTrigger,
    ReadingQuality,
    SensorType,
    Zone,
)
from app.repositories import entities, operations
from app.services.evaluation import LatestReadings, is_stale, now_utc

logger = logging.getLogger(__name__)

_STOP_ACTIONS = {
    ActuatorAction.STOP_IRRIGATION,
    ActuatorAction.CLOSE_VALVE,
    ActuatorAction.RETRACT_SHADE,
}


class RuleOutcome:
    def __init__(self, rule_id: str, fired: bool, reason: str) -> None:
        self.rule_id = rule_id
        self.fired = fired
        self.reason = reason

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<RuleOutcome {self.rule_id} fired={self.fired} {self.reason}>"


def evaluate_rules(
    farm_id: str,
    zones: dict[str, Zone],
    readings_by_zone: dict[str, LatestReadings],
) -> list[RuleOutcome]:
    outcomes: list[RuleOutcome] = []
    rules = entities.list_automation_rules(farm_id)
    if not rules:
        return outcomes

    reservoir = operations.get_latest_reservoir_reading(farm_id)

    for rule in rules:
        outcomes.append(_evaluate_rule(farm_id, rule, zones, readings_by_zone, reservoir))
    return outcomes


def _evaluate_rule(
    farm_id: str,
    rule: AutomationRule,
    zones: dict[str, Zone],
    readings_by_zone: dict[str, LatestReadings],
    reservoir,
) -> RuleOutcome:
    if not rule.enabled:
        return RuleOutcome(rule.id, False, "Rule is disabled")

    if not rule.zone_id or rule.zone_id not in zones:
        return RuleOutcome(rule.id, False, "Rule is not attached to a configured zone")

    zone = zones[rule.zone_id]
    readings = readings_by_zone.get(rule.zone_id, {})
    sensor_type = SensorType(rule.condition_sensor)
    reading = readings.get(sensor_type)

    # --- sensor availability -------------------------------------------------
    if reading is None or is_stale(reading.timestamp) or reading.quality == ReadingQuality.BAD:
        if rule.sensor_failure_behaviour == "HALT":
            _halt(farm_id, zone, rule, "Sensor data is missing, stale or faulty")
            return RuleOutcome(rule.id, False, "Halted: sensor unavailable")
        return RuleOutcome(rule.id, False, "Skipped: sensor unavailable")

    active_session = operations.get_active_irrigation(farm_id, zone.id)

    # --- recovery: stop what is already running ------------------------------
    if active_session is not None and _recovered(rule, reading.value):
        _queue(farm_id, zone, _stop_action_for(rule.action), IrrigationTrigger.AUTOMATION)
        operations.close_irrigation_event(active_session.id, end_moisture=reading.value)
        return RuleOutcome(rule.id, True, "Recovery threshold reached")

    # --- maximum runtime -----------------------------------------------------
    if active_session is not None and rule.max_runtime_minutes is not None:
        elapsed = now_utc() - active_session.started_at
        if elapsed > timedelta(minutes=rule.max_runtime_minutes):
            _queue(farm_id, zone, _stop_action_for(rule.action), IrrigationTrigger.AUTOMATION)
            operations.close_irrigation_event(active_session.id, end_moisture=reading.value)
            return RuleOutcome(rule.id, True, "Maximum runtime reached")

    if active_session is not None:
        return RuleOutcome(rule.id, False, "Already running")

    # --- trigger condition ---------------------------------------------------
    if not _condition_met(rule, reading.value):
        return RuleOutcome(rule.id, False, "Condition not met")

    # --- cooldown ------------------------------------------------------------
    if rule.cooldown_minutes is not None:
        recent = operations.list_irrigation_events(farm_id, zone_id=zone.id, limit=1)
        if recent:
            last_end = recent[0].ended_at or recent[0].started_at
            if now_utc() - last_end < timedelta(minutes=rule.cooldown_minutes):
                return RuleOutcome(rule.id, False, "Cooldown period has not elapsed")

    # --- reservoir guard -----------------------------------------------------
    if rule.min_reservoir_percent is not None and rule.action in {
        ActuatorAction.START_IRRIGATION,
        ActuatorAction.OPEN_VALVE,
    }:
        if reservoir is None or reservoir.level_percent is None:
            return RuleOutcome(rule.id, False, "Reservoir level unknown; irrigation withheld")
        if reservoir.level_percent < rule.min_reservoir_percent:
            return RuleOutcome(rule.id, False, "Reservoir is below the configured minimum")

    # --- fire ----------------------------------------------------------------
    device_id = _actuator_for(zone)
    if device_id is None:
        return RuleOutcome(rule.id, False, "Zone has no actuator assigned")

    operations.create_command(farm_id, zone.id, device_id, rule.action, issued_by=f"rule:{rule.id}")

    if rule.action in {ActuatorAction.START_IRRIGATION, ActuatorAction.OPEN_VALVE}:
        operations.open_irrigation_event(
            farm_id, zone.id, IrrigationTrigger.AUTOMATION, reading.value, initiated_by=f"rule:{rule.id}"
        )
    elif rule.action == ActuatorAction.DEPLOY_SHADE:
        operations.record_shade_event(
            farm_id, zone.id, "DEPLOYED", IrrigationTrigger.AUTOMATION, reading.value
        )

    return RuleOutcome(rule.id, True, "Command queued")


def _condition_met(rule: AutomationRule, value: float) -> bool:
    if rule.condition_operator == "BELOW":
        return value < rule.condition_threshold
    return value > rule.condition_threshold


def _recovered(rule: AutomationRule, value: float) -> bool:
    """Without a configured recovery threshold, nothing is auto-stopped here.

    The max-runtime guard remains the backstop, so equipment cannot run forever.
    """
    if rule.recovery_threshold is None:
        return False
    if rule.condition_operator == "BELOW":
        return value >= rule.recovery_threshold
    return value <= rule.recovery_threshold


def _stop_action_for(action: ActuatorAction) -> ActuatorAction:
    return {
        ActuatorAction.START_IRRIGATION: ActuatorAction.STOP_IRRIGATION,
        ActuatorAction.OPEN_VALVE: ActuatorAction.CLOSE_VALVE,
        ActuatorAction.DEPLOY_SHADE: ActuatorAction.RETRACT_SHADE,
    }.get(action, action)


def _actuator_for(zone: Zone) -> str | None:
    return zone.actuators[0] if zone.actuators else None


def _halt(farm_id: str, zone: Zone, rule: AutomationRule, reason: str) -> None:
    """Fail safe: close anything this rule opened, and say why."""
    session = operations.get_active_irrigation(farm_id, zone.id)
    if session is None:
        return
    device_id = _actuator_for(zone)
    if device_id:
        operations.create_command(
            farm_id, zone.id, device_id, _stop_action_for(rule.action), issued_by=f"rule:{rule.id}"
        )
    operations.close_irrigation_event(session.id)
    logger.warning("Halted rule %s on zone %s: %s", rule.id, zone.id, reason)
