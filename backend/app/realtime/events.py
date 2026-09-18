"""Socket.IO server.

Event names match what the frontend subscribes to in `src/api/socket.ts`.
Clients join a room per farm so telemetry is only broadcast to people scoped to
that farm.
"""

from __future__ import annotations

import logging
from typing import Any

import socketio

from app.config import settings

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origin_list or "*",
    logger=False,
    engineio_logger=False,
)


class Events:
    TELEMETRY_UPDATE = "telemetry:update"
    ZONE_UPDATE = "zone:update"
    DEVICE_STATUS = "device:status"
    IRRIGATION_START = "irrigation:start"
    IRRIGATION_STOP = "irrigation:stop"
    SHADE_DEPLOYED = "shade:deployed"
    SHADE_RETRACTED = "shade:retracted"
    RESERVOIR_UPDATE = "reservoir:update"
    SOLAR_UPDATE = "solar:update"
    ALERT_NEW = "alert:new"
    ALERT_RESOLVED = "alert:resolved"
    SYSTEM_HEALTH = "system:health"


def room_for(farm_id: str) -> str:
    return f"farm:{farm_id}"


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:
    logger.debug("Socket connected: %s", sid)


@sio.event
async def disconnect(sid: str) -> None:
    logger.debug("Socket disconnected: %s", sid)


@sio.on("subscribe")
async def subscribe(sid: str, data: dict[str, Any]) -> dict[str, Any]:
    """Join a farm room. Returns what was joined so the client can confirm."""
    farm_id = (data or {}).get("farmId")
    if not farm_id:
        return {"ok": False, "error": "farmId is required"}
    await sio.enter_room(sid, room_for(farm_id))
    return {"ok": True, "room": room_for(farm_id)}


@sio.on("unsubscribe")
async def unsubscribe(sid: str, data: dict[str, Any]) -> dict[str, Any]:
    farm_id = (data or {}).get("farmId")
    if farm_id:
        await sio.leave_room(sid, room_for(farm_id))
    return {"ok": True}


async def emit(event: str, farm_id: str, payload: Any = None) -> None:
    """Broadcast to one farm's room. Failures never break the request path."""
    try:
        await sio.emit(event, payload or {}, room=room_for(farm_id))
    except Exception as exc:  # pragma: no cover - transport failure
        logger.warning("Could not emit %s for %s: %s", event, farm_id, exc)
