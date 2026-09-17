"""Zones, crop profiles and the crop overview."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, Permission, Principal, require, require_farm_access
from app.models.domain import (
    CropProfile,
    CropType,
    Zone,
    ZoneCreate,
    ZoneEvaluation,
    ZoneUpdate,
)
from app.repositories import entities, telemetry
from app.services.evaluation import evaluate_zone

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zones", response_model=list[Zone])
def list_zones(
    principal: CurrentUser,
    farm_id: str = Query(alias="farmId"),
    field_id: str | None = Query(default=None, alias="fieldId"),
) -> list[Zone]:
    require_farm_access(principal, farm_id)
    return entities.list_zones(farm_id, field_id)


@router.get("/zones/{zone_id}", response_model=Zone)
def get_zone(zone_id: str, principal: CurrentUser) -> Zone:
    zone = entities.get_zone(zone_id)
    require_farm_access(principal, zone.farm_id)
    return zone


@router.get("/zones/{zone_id}/evaluation", response_model=ZoneEvaluation)
def get_zone_evaluation(zone_id: str, principal: CurrentUser) -> ZoneEvaluation:
    """Current status with the reading and threshold that produced it."""
    zone = entities.get_zone(zone_id)
    require_farm_access(principal, zone.farm_id)

    profile = entities.get_crop_profile(zone.crop_profile_id) if zone.crop_profile_id else None
    readings = telemetry.get_latest_readings(zone.farm_id, zone_id)
    return evaluate_zone(zone, readings, profile)


@router.post("/zones", response_model=Zone, status_code=201)
def create_zone(payload: ZoneCreate, principal: CurrentUser) -> Zone:
    require_farm_access(principal, payload.farm_id)
    return entities.create_zone(payload)


@router.patch("/zones/{zone_id}", response_model=Zone)
def update_zone(zone_id: str, payload: ZoneUpdate, principal: CurrentUser) -> Zone:
    zone = entities.get_zone(zone_id)
    require_farm_access(principal, zone.farm_id)
    return entities.update_zone(zone_id, payload)


# --------------------------------------------------------------------------- #
# Crop profiles                                                                 #
# --------------------------------------------------------------------------- #


@router.get("/crop-profiles", response_model=list[CropProfile])
def list_crop_profiles(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[CropProfile]:
    require_farm_access(principal, farm_id)
    return entities.list_crop_profiles(farm_id)


@router.get("/crop-profiles/{profile_id}", response_model=CropProfile)
def get_crop_profile(profile_id: str, principal: CurrentUser) -> CropProfile:
    profile = entities.get_crop_profile(profile_id)
    require_farm_access(principal, profile.farm_id)
    return profile


@router.put("/crop-profiles/{profile_id}", response_model=CropProfile)
def save_crop_profile(
    profile_id: str,
    payload: CropProfile,
    principal: Principal = Depends(require(Permission.EDIT_CROP_PROFILES)),
) -> CropProfile:
    """Only an agronomist, farm manager or administrator may change thresholds."""
    require_farm_access(principal, payload.farm_id)
    saved = entities.save_crop_profile(payload.model_copy(update={"id": profile_id}), principal.uid)
    entities.write_audit_log(
        payload.farm_id, principal.uid, "crop_profile.save", profile_id, {"name": payload.name}
    )
    return saved


@router.get("/crops")
def list_crops(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[dict]:
    """Crop overview: configured profiles and the zones growing each crop."""
    require_farm_access(principal, farm_id)
    zones = entities.list_zones(farm_id)
    profiles = entities.list_crop_profiles(farm_id)

    return [
        {
            "cropType": crop.value,
            "zoneIds": [z.id for z in zones if z.crop_type == crop.value],
            "profileIds": [p.id for p in profiles if p.crop_type == crop.value],
        }
        for crop in CropType
    ]
