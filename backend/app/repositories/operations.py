"""Irrigation, shade, reservoir, flow and energy records."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.core.errors import NotFoundError
from app.firebase.client import Collections
from app.models.domain import (
    ActuatorAction,
    ActuatorCommand,
    BatteryReading,
    CommandState,
    FlowReading,
    IrrigationEvent,
    IrrigationTrigger,
    ReadingQuality,
    ReservoirConfig,
    ReservoirReading,
    ShadeEvent,
    SolarReading,
)
from app.repositories.base import db, snapshot_data, to_datetime, to_float, utcnow

# --------------------------------------------------------------------------- #
# Irrigation                                                                    #
# --------------------------------------------------------------------------- #


def _map_irrigation(data: dict[str, Any], doc_id: str) -> IrrigationEvent | None:
    started_at = to_datetime(data.get("startedAt"))
    if started_at is None:
        return None
    return IrrigationEvent(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=str(data.get("zoneId") or ""),
        started_at=started_at,
        ended_at=to_datetime(data.get("endedAt")),
        duration_seconds=to_float(data.get("durationSeconds")),
        volume_litres=to_float(data.get("volumeLitres")),
        trigger=IrrigationTrigger(data.get("trigger") or IrrigationTrigger.AUTOMATION.value),
        start_moisture=to_float(data.get("startMoisture")),
        end_moisture=to_float(data.get("endMoisture")),
        initiated_by=data.get("initiatedBy"),
    )


def list_irrigation_events(
    farm_id: str,
    zone_id: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 100,
) -> list[IrrigationEvent]:
    query = (
        db()
        .collection(Collections.IRRIGATION_EVENTS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
    )
    if zone_id:
        query = query.where(filter=FieldFilter("zoneId", "==", zone_id))
    if start:
        query = query.where(filter=FieldFilter("startedAt", ">=", start))
    if end:
        query = query.where(filter=FieldFilter("startedAt", "<=", end))

    events = [
        _map_irrigation(snapshot_data(doc), doc.id)
        for doc in query.order_by("startedAt", direction="DESCENDING").limit(limit).stream()
    ]
    return [e for e in events if e is not None]


def get_active_irrigation(farm_id: str, zone_id: str | None = None) -> IrrigationEvent | None:
    """An open session is one with no end time recorded."""
    query = (
        db()
        .collection(Collections.IRRIGATION_EVENTS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
        .where(filter=FieldFilter("endedAt", "==", None))
        .limit(20)
    )
    for doc in query.stream():
        event = _map_irrigation(snapshot_data(doc), doc.id)
        if event and (zone_id is None or event.zone_id == zone_id):
            return event
    return None


def open_irrigation_event(
    farm_id: str,
    zone_id: str,
    trigger: IrrigationTrigger,
    start_moisture: float | None,
    initiated_by: str | None,
) -> IrrigationEvent:
    data = {
        "farmId": farm_id,
        "zoneId": zone_id,
        "startedAt": utcnow(),
        "endedAt": None,
        "trigger": trigger.value if isinstance(trigger, IrrigationTrigger) else trigger,
        "startMoisture": start_moisture,
        "initiatedBy": initiated_by,
    }
    ref = db().collection(Collections.IRRIGATION_EVENTS).document()
    ref.set(data)
    event = _map_irrigation(data, ref.id)
    assert event is not None
    return event


def close_irrigation_event(
    event_id: str, end_moisture: float | None = None, volume_litres: float | None = None
) -> IrrigationEvent:
    ref = db().collection(Collections.IRRIGATION_EVENTS).document(event_id)
    snapshot = ref.get()
    if not snapshot.exists:
        raise NotFoundError("Irrigation event not found.")

    existing = _map_irrigation(snapshot_data(snapshot), snapshot.id)
    if existing is None:
        raise NotFoundError("Irrigation event is not readable.")

    ended_at = utcnow()
    ref.update(
        {
            "endedAt": ended_at,
            "durationSeconds": (ended_at - existing.started_at).total_seconds(),
            "endMoisture": end_moisture,
            "volumeLitres": volume_litres,
        }
    )
    return existing.model_copy(
        update={
            "ended_at": ended_at,
            "duration_seconds": (ended_at - existing.started_at).total_seconds(),
            "end_moisture": end_moisture,
            "volume_litres": volume_litres,
        }
    )


# --------------------------------------------------------------------------- #
# Shade                                                                         #
# --------------------------------------------------------------------------- #


def list_shade_events(farm_id: str, zone_id: str | None = None, limit: int = 100) -> list[ShadeEvent]:
    query = (
        db().collection(Collections.SHADE_EVENTS).where(filter=FieldFilter("farmId", "==", farm_id))
    )
    if zone_id:
        query = query.where(filter=FieldFilter("zoneId", "==", zone_id))

    events: list[ShadeEvent] = []
    for doc in query.order_by("timestamp", direction="DESCENDING").limit(limit).stream():
        data = snapshot_data(doc)
        timestamp = to_datetime(data.get("timestamp"))
        if timestamp is None:
            continue
        events.append(
            ShadeEvent(
                id=doc.id,
                farm_id=farm_id,
                zone_id=str(data.get("zoneId") or ""),
                action=str(data.get("action") or "DEPLOYED"),
                timestamp=timestamp,
                trigger_temperature=to_float(data.get("triggerTemperature")),
                trigger=IrrigationTrigger(data.get("trigger") or IrrigationTrigger.AUTOMATION.value),
            )
        )
    return events


def record_shade_event(
    farm_id: str, zone_id: str, action: str, trigger: IrrigationTrigger, temperature: float | None
) -> ShadeEvent:
    data = {
        "farmId": farm_id,
        "zoneId": zone_id,
        "action": action,
        "timestamp": utcnow(),
        "trigger": trigger.value if isinstance(trigger, IrrigationTrigger) else trigger,
        "triggerTemperature": temperature,
    }
    ref = db().collection(Collections.SHADE_EVENTS).document()
    ref.set(data)
    return ShadeEvent(
        id=ref.id,
        farm_id=farm_id,
        zone_id=zone_id,
        action=action,
        timestamp=data["timestamp"],
        trigger=trigger,
        trigger_temperature=temperature,
    )


# --------------------------------------------------------------------------- #
# Reservoir, flow and energy                                                    #
# --------------------------------------------------------------------------- #


def get_reservoir_config(farm_id: str) -> ReservoirConfig | None:
    snapshot = db().collection(Collections.RESERVOIR_CONFIG).document(farm_id).get()
    if not snapshot.exists:
        return None
    data = snapshot_data(snapshot)
    return ReservoirConfig(
        farm_id=farm_id,
        capacity_litres=to_float(data.get("capacityLitres")),
        height_cm=to_float(data.get("heightCm")),
        sensor_offset_cm=to_float(data.get("sensorOffsetCm")),
        low_level_percent=to_float(data.get("lowLevelPercent")),
        critical_level_percent=to_float(data.get("criticalLevelPercent")),
    )


def save_reservoir_config(config: ReservoirConfig) -> ReservoirConfig:
    db().collection(Collections.RESERVOIR_CONFIG).document(config.farm_id).set(
        config.model_dump(by_alias=True, exclude={"farm_id"}), merge=True
    )
    return config


def _latest(collection: str, farm_id: str, zone_id: str | None = None):
    query = db().collection(collection).where(filter=FieldFilter("farmId", "==", farm_id))
    if zone_id:
        query = query.where(filter=FieldFilter("zoneId", "==", zone_id))
    docs = list(query.order_by("timestamp", direction="DESCENDING").limit(1).stream())
    return docs[0] if docs else None


def get_latest_reservoir_reading(farm_id: str) -> ReservoirReading | None:
    doc = _latest(Collections.RESERVOIR_READINGS, farm_id)
    if doc is None:
        return None
    data = snapshot_data(doc)
    timestamp = to_datetime(data.get("timestamp"))
    if timestamp is None:
        return None
    return ReservoirReading(
        id=doc.id,
        farm_id=farm_id,
        level_percent=to_float(data.get("levelPercent")),
        distance_cm=to_float(data.get("distanceCm")),
        estimated_litres=to_float(data.get("estimatedLitres")),
        timestamp=timestamp,
        quality=ReadingQuality(data.get("quality") or ReadingQuality.GOOD.value),
    )


def write_reservoir_reading(reading: ReservoirReading) -> ReservoirReading:
    ref = db().collection(Collections.RESERVOIR_READINGS).document()
    ref.set(reading.model_dump(by_alias=True, exclude={"id"}))
    return reading.model_copy(update={"id": ref.id})


def get_latest_flow_reading(farm_id: str, zone_id: str | None = None) -> FlowReading | None:
    doc = _latest(Collections.FLOW_READINGS, farm_id, zone_id)
    if doc is None:
        return None
    data = snapshot_data(doc)
    litres = to_float(data.get("litresPerMinute"))
    timestamp = to_datetime(data.get("timestamp"))
    if litres is None or timestamp is None:
        return None
    return FlowReading(
        id=doc.id, farm_id=farm_id, zone_id=data.get("zoneId"), litres_per_minute=litres, timestamp=timestamp
    )


def write_flow_reading(reading: FlowReading) -> FlowReading:
    ref = db().collection(Collections.FLOW_READINGS).document()
    ref.set(reading.model_dump(by_alias=True, exclude={"id"}))
    return reading.model_copy(update={"id": ref.id})


def get_latest_solar_reading(farm_id: str) -> SolarReading | None:
    doc = _latest(Collections.SOLAR_READINGS, farm_id)
    if doc is None:
        return None
    data = snapshot_data(doc)
    timestamp = to_datetime(data.get("timestamp"))
    if timestamp is None:
        return None
    return SolarReading(
        id=doc.id,
        farm_id=farm_id,
        voltage=to_float(data.get("voltage")),
        current=to_float(data.get("current")),
        power_watts=to_float(data.get("powerWatts")),
        timestamp=timestamp,
    )


def write_solar_reading(reading: SolarReading) -> SolarReading:
    ref = db().collection(Collections.SOLAR_READINGS).document()
    ref.set(reading.model_dump(by_alias=True, exclude={"id"}))
    return reading.model_copy(update={"id": ref.id})


def get_latest_battery_reading(farm_id: str) -> BatteryReading | None:
    doc = _latest(Collections.BATTERY_READINGS, farm_id)
    if doc is None:
        return None
    data = snapshot_data(doc)
    timestamp = to_datetime(data.get("timestamp"))
    if timestamp is None:
        return None
    charging = data.get("charging")
    return BatteryReading(
        id=doc.id,
        farm_id=farm_id,
        voltage=to_float(data.get("voltage")),
        percent=to_float(data.get("percent")),
        charging=charging if isinstance(charging, bool) else None,
        timestamp=timestamp,
    )


def write_battery_reading(reading: BatteryReading) -> BatteryReading:
    ref = db().collection(Collections.BATTERY_READINGS).document()
    ref.set(reading.model_dump(by_alias=True, exclude={"id"}))
    return reading.model_copy(update={"id": ref.id})


# --------------------------------------------------------------------------- #
# Commands                                                                      #
# --------------------------------------------------------------------------- #


def _map_command(data: dict[str, Any], doc_id: str) -> ActuatorCommand:
    return ActuatorCommand(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=data.get("zoneId"),
        device_id=str(data.get("deviceId") or ""),
        action=ActuatorAction(data.get("action")),
        state=CommandState(data.get("state") or CommandState.WAITING_FOR_DEVICE.value),
        issued_by=str(data.get("issuedBy") or ""),
        issued_at=to_datetime(data.get("issuedAt")) or utcnow(),
        confirmed_at=to_datetime(data.get("confirmedAt")),
        failure_reason=data.get("failureReason"),
    )


def create_command(
    farm_id: str, zone_id: str | None, device_id: str, action: ActuatorAction, issued_by: str
) -> ActuatorCommand:
    """Queue a command. It starts as ACCEPTED — queued, not performed."""
    data = {
        "farmId": farm_id,
        "zoneId": zone_id,
        "deviceId": device_id,
        "action": action.value if isinstance(action, ActuatorAction) else action,
        "state": CommandState.ACCEPTED.value,
        "issuedBy": issued_by,
        "issuedAt": utcnow(),
        "confirmedAt": None,
        "failureReason": None,
    }
    ref = db().collection(Collections.COMMANDS).document()
    ref.set(data)
    return _map_command(data, ref.id)


def get_command(command_id: str) -> ActuatorCommand:
    snapshot = db().collection(Collections.COMMANDS).document(command_id).get()
    if not snapshot.exists:
        raise NotFoundError("Command not found.")
    return _map_command(snapshot_data(snapshot), snapshot.id)


def update_command_state(
    command_id: str, state: CommandState, failure_reason: str | None = None
) -> ActuatorCommand:
    patch: dict[str, Any] = {
        "state": state.value if isinstance(state, CommandState) else state,
        "failureReason": failure_reason,
    }
    if state is CommandState.CONFIRMED:
        patch["confirmedAt"] = utcnow()
    db().collection(Collections.COMMANDS).document(command_id).update(patch)
    return get_command(command_id)


def list_pending_commands(device_id: str, limit: int = 20) -> list[ActuatorCommand]:
    """Commands the device has not yet acted on — its polling queue."""
    query = (
        db()
        .collection(Collections.COMMANDS)
        .where(filter=FieldFilter("deviceId", "==", device_id))
        .where(
            filter=FieldFilter(
                "state", "in", [CommandState.ACCEPTED.value, CommandState.WAITING_FOR_DEVICE.value]
            )
        )
        .limit(limit)
    )
    return [_map_command(snapshot_data(doc), doc.id) for doc in query.stream()]


def list_recent_commands(farm_id: str, limit: int = 50) -> list[ActuatorCommand]:
    query = (
        db()
        .collection(Collections.COMMANDS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
        .order_by("issuedAt", direction="DESCENDING")
        .limit(limit)
    )
    return [_map_command(snapshot_data(doc), doc.id) for doc in query.stream()]
