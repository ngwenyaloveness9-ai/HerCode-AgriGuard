"""Irrigation, shade, reservoir, energy and actuator commands."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.errors import ForbiddenError, ValidationError
from app.core.security import (
    CurrentUser,
    Permission,
    Principal,
    require,
    require_farm_access,
    verify_device_key,
)
from app.models.domain import (
    ActuatorAction,
    ActuatorCommand,
    BatteryReading,
    CommandAck,
    CommandCreate,
    CommandState,
    FlowReading,
    IrrigationEvent,
    IrrigationTrigger,
    ReservoirConfig,
    ReservoirReading,
    ShadeEvent,
    SolarReading,
)
from app.realtime.events import Events, emit
from app.repositories import entities, operations, telemetry
from app.models.domain import SensorType

router = APIRouter(prefix="/api", tags=["irrigation"])


# --------------------------------------------------------------------------- #
# Reads                                                                         #
# --------------------------------------------------------------------------- #


@router.get("/irrigation/events", response_model=list[IrrigationEvent])
def list_events(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = Query(default=100, le=1000),
) -> list[IrrigationEvent]:
    require_farm_access(principal, farm_id)
    return operations.list_irrigation_events(farm_id, zone_id, from_, to, limit)


@router.get("/irrigation/active", response_model=IrrigationEvent | None)
def active_session(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> IrrigationEvent | None:
    require_farm_access(principal, farm_id)
    return operations.get_active_irrigation(farm_id, zone_id)


@router.get("/irrigation/flow/latest", response_model=FlowReading | None)
def latest_flow(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> FlowReading | None:
    require_farm_access(principal, farm_id)
    return operations.get_latest_flow_reading(farm_id, zone_id)


@router.get("/shade/events", response_model=list[ShadeEvent])
def list_shade(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    zone_id: str | None = Query(default=None, alias="zoneId"),
) -> list[ShadeEvent]:
    require_farm_access(principal, farm_id)
    return operations.list_shade_events(farm_id, zone_id)


@router.get("/reservoir/config", response_model=ReservoirConfig | None)
def reservoir_config(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> ReservoirConfig | None:
    require_farm_access(principal, farm_id)
    return operations.get_reservoir_config(farm_id)


@router.put("/reservoir/config", response_model=ReservoirConfig)
def save_reservoir_config(
    payload: ReservoirConfig,
    principal: Principal = Depends(require(Permission.EDIT_AUTOMATION)),
) -> ReservoirConfig:
    """Geometry lives here. Without it, litres are never reported."""
    require_farm_access(principal, payload.farm_id)
    return operations.save_reservoir_config(payload)


@router.get("/reservoir/latest", response_model=ReservoirReading | None)
def latest_reservoir(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> ReservoirReading | None:
    require_farm_access(principal, farm_id)
    return operations.get_latest_reservoir_reading(farm_id)


@router.get("/solar/latest", response_model=SolarReading | None)
def latest_solar(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> SolarReading | None:
    require_farm_access(principal, farm_id)
    return operations.get_latest_solar_reading(farm_id)


@router.get("/solar/battery/latest", response_model=BatteryReading | None)
def latest_battery(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> BatteryReading | None:
    require_farm_access(principal, farm_id)
    return operations.get_latest_battery_reading(farm_id)


# --------------------------------------------------------------------------- #
# Commands                                                                      #
# --------------------------------------------------------------------------- #


@router.post("/irrigation/commands", response_model=ActuatorCommand, status_code=202)
async def send_command(
    payload: CommandCreate,
    principal: Principal = Depends(require(Permission.CONTROL_ACTUATORS)),
) -> ActuatorCommand:
    """Queue an actuator command.

    202 means the command was accepted for delivery — not that the equipment
    moved. The device's acknowledgement is the only thing that can produce
    CONFIRMED.
    """
    require_farm_access(principal, payload.farm_id)

    device = entities.get_device(payload.device_id)
    if device.farm_id != payload.farm_id:
        raise ValidationError("That device does not belong to this farm.")

    command = operations.create_command(
        payload.farm_id, payload.zone_id, payload.device_id, payload.action, principal.uid
    )

    if payload.zone_id and payload.action in {
        ActuatorAction.START_IRRIGATION,
        ActuatorAction.OPEN_VALVE,
    }:
        readings = telemetry.get_latest_readings(payload.farm_id, payload.zone_id)
        moisture = readings.get(SensorType.SOIL_MOISTURE)
        operations.open_irrigation_event(
            payload.farm_id,
            payload.zone_id,
            IrrigationTrigger.MANUAL,
            moisture.value if moisture else None,
            principal.uid,
        )

    entities.write_audit_log(
        payload.farm_id,
        principal.uid,
        "command.issue",
        payload.device_id,
        {"action": payload.action, "zoneId": payload.zone_id},
    )
    await emit(Events.DEVICE_STATUS, payload.farm_id, {"commandId": command.id, "state": command.state})
    return command


@router.get("/irrigation/commands/{command_id}", response_model=ActuatorCommand)
def get_command(command_id: str, principal: CurrentUser) -> ActuatorCommand:
    command = operations.get_command(command_id)
    require_farm_access(principal, command.farm_id)
    return command


@router.get("/irrigation/commands", response_model=list[ActuatorCommand])
def recent_commands(
    principal: CurrentUser, farm_id: str = Query(alias="farmId"), limit: int = Query(default=50, le=200)
) -> list[ActuatorCommand]:
    require_farm_access(principal, farm_id)
    return operations.list_recent_commands(farm_id, limit)


# --------------------------------------------------------------------------- #
# Device-side command queue                                                     #
# --------------------------------------------------------------------------- #


@router.get(
    "/irrigation/devices/{device_id}/queue",
    response_model=list[ActuatorCommand],
    dependencies=[Depends(verify_device_key)],
)
def device_queue(device_id: str) -> list[ActuatorCommand]:
    """Commands awaiting this device. Polled by the ESP32."""
    commands = operations.list_pending_commands(device_id)
    for command in commands:
        if command.state == CommandState.ACCEPTED:
            operations.update_command_state(command.id, CommandState.WAITING_FOR_DEVICE)
    return commands


@router.post(
    "/irrigation/commands/{command_id}/ack",
    response_model=ActuatorCommand,
    dependencies=[Depends(verify_device_key)],
)
async def acknowledge_command(command_id: str, payload: CommandAck) -> ActuatorCommand:
    """The device reports what actually happened.

    This is the only route that can set CONFIRMED, which is why the UI can
    treat "Pump on" as a fact rather than an expectation.
    """
    if payload.state not in {CommandState.CONFIRMED, CommandState.FAILED, CommandState.WAITING_FOR_DEVICE}:
        raise ValidationError("A device may only report WAITING_FOR_DEVICE, CONFIRMED or FAILED.")

    command = operations.update_command_state(command_id, payload.state, payload.failure_reason)

    if payload.state is CommandState.CONFIRMED:
        await _record_confirmed_effect(command)

    await emit(
        Events.DEVICE_STATUS,
        command.farm_id,
        {"commandId": command.id, "state": command.state, "deviceId": command.device_id},
    )
    return command


async def _record_confirmed_effect(command: ActuatorCommand) -> None:
    """Operational history is written on confirmation, not on request."""
    action = ActuatorAction(command.action)

    if action in {ActuatorAction.START_IRRIGATION, ActuatorAction.OPEN_VALVE}:
        await emit(Events.IRRIGATION_START, command.farm_id, {"zoneId": command.zone_id})

    elif action in {ActuatorAction.STOP_IRRIGATION, ActuatorAction.CLOSE_VALVE} and command.zone_id:
        session = operations.get_active_irrigation(command.farm_id, command.zone_id)
        if session is not None:
            readings = telemetry.get_latest_readings(command.farm_id, command.zone_id)
            moisture = readings.get(SensorType.SOIL_MOISTURE)
            operations.close_irrigation_event(
                session.id, end_moisture=moisture.value if moisture else None
            )
        await emit(Events.IRRIGATION_STOP, command.farm_id, {"zoneId": command.zone_id})

    elif action is ActuatorAction.DEPLOY_SHADE and command.zone_id:
        operations.record_shade_event(
            command.farm_id, command.zone_id, "DEPLOYED", IrrigationTrigger.MANUAL, None
        )
        await emit(Events.SHADE_DEPLOYED, command.farm_id, {"zoneId": command.zone_id})

    elif action is ActuatorAction.RETRACT_SHADE and command.zone_id:
        operations.record_shade_event(
            command.farm_id, command.zone_id, "RETRACTED", IrrigationTrigger.MANUAL, None
        )
        await emit(Events.SHADE_RETRACTED, command.farm_id, {"zoneId": command.zone_id})
