"""Farms and fields."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.security import CurrentUser, require_farm_access
from app.models.domain import Farm, FarmCreate, Field_, FieldCreate, UserRole
from app.repositories import entities

router = APIRouter(prefix="/api", tags=["farms"])


@router.get("/farms", response_model=list[Farm])
def list_farms(principal: CurrentUser) -> list[Farm]:
    return entities.list_farms(principal.uid, is_admin=principal.role is UserRole.ADMINISTRATOR)


@router.get("/farms/{farm_id}", response_model=Farm)
def get_farm(farm_id: str, principal: CurrentUser) -> Farm:
    require_farm_access(principal, farm_id)
    return entities.get_farm(farm_id)


@router.post("/farms", response_model=Farm, status_code=201)
def create_farm(payload: FarmCreate, principal: CurrentUser) -> Farm:
    return entities.create_farm(payload, principal.uid)


@router.get("/fields", response_model=list[Field_])
def list_fields(principal: CurrentUser, farm_id: str = Query(alias="farmId")) -> list[Field_]:
    require_farm_access(principal, farm_id)
    return entities.list_fields(farm_id)


@router.post("/fields", response_model=Field_, status_code=201)
def create_field(payload: FieldCreate, principal: CurrentUser) -> Field_:
    require_farm_access(principal, payload.farm_id)
    return entities.create_field(payload)
