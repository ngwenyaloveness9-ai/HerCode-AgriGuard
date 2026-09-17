"""AgriGuard 3D API.

FastAPI over Firestore, with Socket.IO mounted for live telemetry.

Two things are deliberate here and worth reading before changing anything:

* A missing Firebase configuration produces 503, not empty collections. An
  unconfigured deployment must never be mistakable for a farm with no sensors.
* Unhandled exceptions return an error, never a fallback payload. There is no
  code path that substitutes example data when something upstream fails.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, devices, farms, irrigation, telemetry, zones
from app.config import settings
from app.core.errors import AppError
from app.firebase.client import FirebaseNotConfigured, firebase_ready, get_db
from app.realtime.events import sio

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("agriguard")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if firebase_ready():
        logger.info("Firebase initialised (project: %s)", settings.firebase_project_id or "default")
    else:
        logger.warning(
            "Firebase is NOT configured. Data endpoints will return 503 until "
            "GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_JSON is set."
        )
    yield
    logger.info("Shutting down")


api = FastAPI(
    title="AgriGuard 3D API",
    description=(
        "Precision irrigation and climate-defence telemetry for macadamia and citrus orchards. "
        "All agronomic thresholds come from configured crop profiles; the API never supplies "
        "a default threshold or a placeholder reading."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

api.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@api.middleware("http")
async def timing(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Response-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


# --------------------------------------------------------------------------- #
# Error handling                                                                #
# --------------------------------------------------------------------------- #


@api.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"message": exc.message, "code": exc.code})


@api.exception_handler(FirebaseNotConfigured)
async def handle_firebase_not_configured(_: Request, exc: FirebaseNotConfigured) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"message": str(exc), "code": "firebase_not_configured"},
    )


@api.exception_handler(RequestValidationError)
async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"message": "The request was not valid.", "code": "validation_error", "detail": exc.errors()},
    )


@api.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"message": "The request could not be completed.", "code": "internal_error"},
    )


# --------------------------------------------------------------------------- #
# Health                                                                        #
# --------------------------------------------------------------------------- #


@api.get("/health", tags=["health"])
def health() -> dict:
    """Liveness plus a real Firestore round trip."""
    database = "unknown"
    if firebase_ready():
        try:
            next(get_db().collections(), None)
            database = "reachable"
        except Exception as exc:
            logger.warning("Firestore health probe failed: %s", exc)
            database = "unreachable"
    else:
        database = "not_configured"

    return {
        "status": "ok" if database == "reachable" else "degraded",
        "environment": settings.environment,
        "firebase": firebase_ready(),
        "database": database,
        "staleDataSeconds": settings.stale_data_seconds,
        "deviceIngestEnabled": bool(settings.device_ingest_key),
    }


for router in (
    auth.router,
    farms.router,
    zones.router,
    telemetry.router,
    irrigation.router,
    devices.router,
):
    api.include_router(router)


# Socket.IO shares the port; the REST app is mounted under it.
app = socketio.ASGIApp(sio, other_asgi_app=api, socketio_path="socket.io")


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=not settings.is_production)
