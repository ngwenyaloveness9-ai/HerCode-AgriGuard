"""Entity repositories.

Every mapper preserves absence. An optional numeric threshold that is missing
from a document stays ``None`` all the way to the evaluator, which is what makes
"not configured" a distinguishable state rather than a silent zero.
"""

from __future__ import annotations

from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.core.errors import NotFoundError
from app.firebase.client import Collections
from app.models.domain import (
    Alert,
    AlertCategory,
    AlertSeverity,
    AutomationRule,
    CropProfile,
    CropType,
    Device,
    DeviceHealth,
    DeviceStatus,
    DeviceType,
    Farm,
    FarmCreate,
    Field_,
    FieldCreate,
    SensorType,
    SystemHealth,
    User,
    UserCreate,
    UserRole,
    Zone,
    ZoneCreate,
    ZoneStatus,
    ZoneUpdate,
)
from app.repositories.base import db, snapshot_data, to_datetime, to_float, utcnow

# --------------------------------------------------------------------------- #
# Farms and fields                                                              #
# --------------------------------------------------------------------------- #


def _map_farm(data: dict[str, Any], doc_id: str) -> Farm:
    coordinates = None
    lat, lng = to_float(data.get("latitude")), to_float(data.get("longitude"))
    if lat is not None and lng is not None:
        coordinates = {"latitude": lat, "longitude": lng}

    return Farm(
        id=doc_id,
        name=str(data.get("name") or "Unnamed farm"),
        organisation=data.get("organisation"),
        region=data.get("region"),
        timezone=data.get("timezone"),
        coordinates=coordinates,
        created_at=to_datetime(data.get("createdAt")) or utcnow(),
    )


def list_farms(user_id: str, is_admin: bool = False) -> list[Farm]:
    collection = db().collection(Collections.FARMS)
    query = (
        collection
        if is_admin
        else collection.where(filter=FieldFilter("memberIds", "array_contains", user_id))
    )
    return [_map_farm(snapshot_data(doc), doc.id) for doc in query.stream()]


def get_farm(farm_id: str) -> Farm:
    snapshot = db().collection(Collections.FARMS).document(farm_id).get()
    if not snapshot.exists:
        raise NotFoundError("Farm not found.")
    return _map_farm(snapshot_data(snapshot), snapshot.id)


def create_farm(payload: FarmCreate, owner_id: str) -> Farm:
    data: dict[str, Any] = {
        "name": payload.name,
        "organisation": payload.organisation,
        "region": payload.region,
        "timezone": payload.timezone,
        "memberIds": [owner_id],
        "ownerId": owner_id,
        "createdAt": utcnow(),
    }
    if payload.coordinates:
        data["latitude"] = payload.coordinates.latitude
        data["longitude"] = payload.coordinates.longitude

    ref = db().collection(Collections.FARMS).document()
    ref.set(data)

    # Keep the user's own farm list in step so their next sign-in scopes correctly.
    db().collection(Collections.USERS).document(owner_id).set(
        {"farmIds": _appended(owner_id, ref.id)}, merge=True
    )
    return _map_farm(data, ref.id)


def _appended(user_id: str, farm_id: str) -> list[str]:
    snapshot = db().collection(Collections.USERS).document(user_id).get()
    existing = list((snapshot_data(snapshot).get("farmIds") or [])) if snapshot.exists else []
    return existing if farm_id in existing else [*existing, farm_id]


def list_fields(farm_id: str) -> list[Field_]:
    query = db().collection(Collections.FIELDS).where(filter=FieldFilter("farmId", "==", farm_id))
    fields: list[Field_] = []
    for doc in query.stream():
        data = snapshot_data(doc)
        fields.append(
            Field_(
                id=doc.id,
                farm_id=farm_id,
                name=str(data.get("name") or "Unnamed field"),
                area_hectares=to_float(data.get("areaHectares")),
                created_at=to_datetime(data.get("createdAt")) or utcnow(),
            )
        )
    return fields


def create_field(payload: FieldCreate) -> Field_:
    data = {
        "farmId": payload.farm_id,
        "name": payload.name,
        "areaHectares": payload.area_hectares,
        "createdAt": utcnow(),
    }
    ref = db().collection(Collections.FIELDS).document()
    ref.set(data)
    return Field_(
        id=ref.id,
        farm_id=payload.farm_id,
        name=payload.name,
        area_hectares=payload.area_hectares,
        created_at=data["createdAt"],
    )


# --------------------------------------------------------------------------- #
# Zones                                                                         #
# --------------------------------------------------------------------------- #


def _map_zone(data: dict[str, Any], doc_id: str) -> Zone:
    return Zone(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        field_id=data.get("fieldId"),
        name=str(data.get("name") or "Unnamed zone"),
        crop_type=CropType(data.get("cropType") or CropType.MACADAMIA.value),
        cultivar=data.get("cultivar"),
        growth_stage=data.get("growthStage"),
        soil_type=data.get("soilType"),
        crop_profile_id=data.get("cropProfileId"),
        root_zone_depth_cm=to_float(data.get("rootZoneDepthCm")),
        irrigation_method=data.get("irrigationMethod"),
        status=ZoneStatus(data.get("status") or ZoneStatus.UNKNOWN.value),
        sensors=list(data.get("sensors") or []),
        actuators=list(data.get("actuators") or []),
        last_updated=to_datetime(data.get("lastUpdated")),
    )


def list_zones(farm_id: str, field_id: str | None = None) -> list[Zone]:
    query = db().collection(Collections.ZONES).where(filter=FieldFilter("farmId", "==", farm_id))
    if field_id:
        query = query.where(filter=FieldFilter("fieldId", "==", field_id))
    return [_map_zone(snapshot_data(doc), doc.id) for doc in query.stream()]


def get_zone(zone_id: str) -> Zone:
    snapshot = db().collection(Collections.ZONES).document(zone_id).get()
    if not snapshot.exists:
        raise NotFoundError("Zone not found.")
    return _map_zone(snapshot_data(snapshot), snapshot.id)


def create_zone(payload: ZoneCreate) -> Zone:
    data = {
        "farmId": payload.farm_id,
        "fieldId": payload.field_id,
        "name": payload.name,
        "cropType": payload.crop_type,
        "cultivar": payload.cultivar,
        "growthStage": payload.growth_stage,
        "soilType": payload.soil_type,
        "cropProfileId": payload.crop_profile_id,
        "rootZoneDepthCm": payload.root_zone_depth_cm,
        "irrigationMethod": payload.irrigation_method,
        # A brand-new zone has no telemetry, so it starts as UNKNOWN, not NORMAL.
        "status": ZoneStatus.UNKNOWN.value,
        "sensors": payload.sensors,
        "actuators": payload.actuators,
    }
    ref = db().collection(Collections.ZONES).document()
    ref.set(data)
    return _map_zone(data, ref.id)


def update_zone(zone_id: str, payload: ZoneUpdate) -> Zone:
    patch = {
        key: value
        for key, value in payload.model_dump(by_alias=True, exclude_none=True).items()
    }
    if not patch:
        return get_zone(zone_id)
    db().collection(Collections.ZONES).document(zone_id).update(patch)
    return get_zone(zone_id)


def set_zone_status(zone_id: str, status: ZoneStatus, last_updated) -> None:
    db().collection(Collections.ZONES).document(zone_id).set(
        {"status": status.value if isinstance(status, ZoneStatus) else status, "lastUpdated": last_updated},
        merge=True,
    )


# --------------------------------------------------------------------------- #
# Crop profiles                                                                 #
# --------------------------------------------------------------------------- #

_PROFILE_NUMERIC_FIELDS = (
    "rootZoneDepthCm",
    "moistureMin",
    "moistureTargetLow",
    "moistureTargetHigh",
    "moistureCriticalLow",
    "moistureExcessHigh",
    "temperatureMin",
    "temperatureTargetLow",
    "temperatureTargetHigh",
    "temperatureCriticalHigh",
    "humidityTargetLow",
    "humidityTargetHigh",
    "lightThreshold",
    "irrigationStartThreshold",
    "irrigationStopThreshold",
    "shadeActivationTemperature",
    "shadeDeactivationTemperature",
)


def _map_profile(data: dict[str, Any], doc_id: str) -> CropProfile:
    numeric = {key: to_float(data.get(key)) for key in _PROFILE_NUMERIC_FIELDS}
    return CropProfile(
        id=doc_id,
        farmId=str(data.get("farmId") or ""),
        name=str(data.get("name") or "Unnamed profile"),
        cropType=CropType(data.get("cropType") or CropType.MACADAMIA.value),
        cultivar=data.get("cultivar"),
        growthStage=data.get("growthStage"),
        soilType=data.get("soilType"),
        irrigationMethod=data.get("irrigationMethod"),
        moistureMeasurementType=data.get("moistureMeasurementType"),
        updatedAt=to_datetime(data.get("updatedAt")),
        updatedBy=data.get("updatedBy"),
        **numeric,
    )


def list_crop_profiles(farm_id: str) -> list[CropProfile]:
    query = (
        db().collection(Collections.CROP_PROFILES).where(filter=FieldFilter("farmId", "==", farm_id))
    )
    return [_map_profile(snapshot_data(doc), doc.id) for doc in query.stream()]


def get_crop_profile(profile_id: str) -> CropProfile:
    snapshot = db().collection(Collections.CROP_PROFILES).document(profile_id).get()
    if not snapshot.exists:
        raise NotFoundError("Crop profile not found.")
    return _map_profile(snapshot_data(snapshot), snapshot.id)


def save_crop_profile(profile: CropProfile, updated_by: str) -> CropProfile:
    data = profile.model_dump(by_alias=True, exclude={"id"})
    data["updatedAt"] = utcnow()
    data["updatedBy"] = updated_by
    db().collection(Collections.CROP_PROFILES).document(profile.id).set(data, merge=True)
    return get_crop_profile(profile.id)


def profiles_by_id(farm_id: str) -> dict[str, CropProfile]:
    return {profile.id: profile for profile in list_crop_profiles(farm_id)}


# --------------------------------------------------------------------------- #
# Devices                                                                       #
# --------------------------------------------------------------------------- #


def _map_device(data: dict[str, Any], doc_id: str) -> Device:
    raw_type = data.get("deviceType")
    device_type = (
        DeviceType(raw_type) if raw_type in {d.value for d in DeviceType} else DeviceType.ESP32
    )
    raw_status = data.get("status")
    status = (
        DeviceStatus(raw_status)
        if raw_status in {s.value for s in DeviceStatus}
        # Absence of a health record is UNKNOWN. It is never ONLINE.
        else DeviceStatus.UNKNOWN
    )
    return Device(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=data.get("zoneId"),
        name=str(data.get("name") or doc_id),
        device_type=device_type,
        status=status,
        last_seen=to_datetime(data.get("lastSeen")),
        firmware_version=data.get("firmwareVersion"),
        battery_percent=to_float(data.get("batteryPercent")),
        signal_strength_dbm=to_float(data.get("signalStrengthDbm")),
    )


def list_devices(farm_id: str) -> list[Device]:
    query = db().collection(Collections.DEVICES).where(filter=FieldFilter("farmId", "==", farm_id))
    return [_map_device(snapshot_data(doc), doc.id) for doc in query.stream()]


def get_device(device_id: str) -> Device:
    snapshot = db().collection(Collections.DEVICES).document(device_id).get()
    if not snapshot.exists:
        raise NotFoundError("Device not found.")
    return _map_device(snapshot_data(snapshot), snapshot.id)


def touch_device(device_id: str, farm_id: str, seen_at) -> None:
    """Record a heartbeat. Only a device that just spoke is marked ONLINE."""
    db().collection(Collections.DEVICES).document(device_id).set(
        {"farmId": farm_id, "lastSeen": seen_at, "status": DeviceStatus.ONLINE.value},
        merge=True,
    )


def get_system_health(farm_id: str) -> SystemHealth | None:
    snapshot = db().collection(Collections.SYSTEM_HEALTH).document(farm_id).get()
    if not snapshot.exists:
        return None
    data = snapshot_data(snapshot)
    components = [
        DeviceHealth(
            device_id=str(item.get("deviceId") or ""),
            status=DeviceStatus(item.get("status") or DeviceStatus.UNKNOWN.value),
            last_seen=to_datetime(item.get("lastSeen")),
            message=item.get("message"),
        )
        for item in (data.get("components") or [])
    ]
    return SystemHealth(
        components=components,
        backend=DeviceStatus(data.get("backend") or DeviceStatus.UNKNOWN.value),
        database=DeviceStatus(data.get("database") or DeviceStatus.UNKNOWN.value),
        network=DeviceStatus(data.get("network") or DeviceStatus.UNKNOWN.value),
        reported_at=to_datetime(data.get("reportedAt")),
    )


def save_system_health(farm_id: str, health: SystemHealth) -> None:
    db().collection(Collections.SYSTEM_HEALTH).document(farm_id).set(
        health.model_dump(by_alias=True), merge=True
    )


# --------------------------------------------------------------------------- #
# Alerts                                                                        #
# --------------------------------------------------------------------------- #


def _map_alert(data: dict[str, Any], doc_id: str) -> Alert:
    crop = data.get("cropType")
    return Alert(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=data.get("zoneId"),
        crop_type=CropType(crop) if crop in {c.value for c in CropType} else None,
        category=AlertCategory(data.get("category") or AlertCategory.DEVICE.value),
        severity=AlertSeverity(data.get("severity") or AlertSeverity.INFO.value),
        title=str(data.get("title") or "Alert"),
        trigger=str(data.get("trigger") or ""),
        measured_value=to_float(data.get("measuredValue")),
        configured_threshold=to_float(data.get("configuredThreshold")),
        unit=data.get("unit"),
        system_response=data.get("systemResponse"),
        timestamp=to_datetime(data.get("timestamp")) or utcnow(),
        resolved_at=to_datetime(data.get("resolvedAt")),
        resolved_by=data.get("resolvedBy"),
    )


def list_alerts(farm_id: str, resolved: bool | None = None, limit: int = 200) -> list[Alert]:
    query = db().collection(Collections.ALERTS).where(filter=FieldFilter("farmId", "==", farm_id))
    if resolved is False:
        query = query.where(filter=FieldFilter("resolvedAt", "==", None))
    alerts = [
        _map_alert(snapshot_data(doc), doc.id)
        for doc in query.order_by("timestamp", direction="DESCENDING").limit(limit).stream()
    ]
    if resolved is True:
        alerts = [a for a in alerts if a.resolved_at is not None]
    return alerts


def create_alert(alert: Alert) -> Alert:
    data = alert.model_dump(by_alias=True, exclude={"id"})
    ref = db().collection(Collections.ALERTS).document()
    ref.set(data)
    return alert.model_copy(update={"id": ref.id})


def find_open_alert(farm_id: str, zone_id: str | None, category: AlertCategory) -> Alert | None:
    query = (
        db()
        .collection(Collections.ALERTS)
        .where(filter=FieldFilter("farmId", "==", farm_id))
        .where(filter=FieldFilter("category", "==", category.value))
        .where(filter=FieldFilter("resolvedAt", "==", None))
        .limit(10)
    )
    for doc in query.stream():
        alert = _map_alert(snapshot_data(doc), doc.id)
        if alert.zone_id == zone_id:
            return alert
    return None


def resolve_alert(alert_id: str, user_id: str) -> Alert:
    ref = db().collection(Collections.ALERTS).document(alert_id)
    if not ref.get().exists:
        raise NotFoundError("Alert not found.")
    ref.update({"resolvedAt": utcnow(), "resolvedBy": user_id})
    snapshot = ref.get()
    return _map_alert(snapshot_data(snapshot), snapshot.id)


# --------------------------------------------------------------------------- #
# Automation                                                                    #
# --------------------------------------------------------------------------- #


def _map_rule(data: dict[str, Any], doc_id: str) -> AutomationRule | None:
    sensor = data.get("conditionSensor")
    threshold = to_float(data.get("conditionThreshold"))
    if sensor not in {s.value for s in SensorType} or threshold is None:
        # A rule without a sensor or a threshold cannot be acted on safely.
        return None
    return AutomationRule(
        id=doc_id,
        farm_id=str(data.get("farmId") or ""),
        zone_id=data.get("zoneId"),
        name=str(data.get("name") or "Rule"),
        enabled=bool(data.get("enabled")),
        condition_sensor=SensorType(sensor),
        condition_operator=str(data.get("conditionOperator") or "BELOW"),
        condition_threshold=threshold,
        action=data.get("action"),
        recovery_threshold=to_float(data.get("recoveryThreshold")),
        max_runtime_minutes=to_float(data.get("maxRuntimeMinutes")),
        min_reservoir_percent=to_float(data.get("minReservoirPercent")),
        cooldown_minutes=to_float(data.get("cooldownMinutes")),
        sensor_failure_behaviour=str(data.get("sensorFailureBehaviour") or "HALT"),
        updated_at=to_datetime(data.get("updatedAt")),
    )


def list_automation_rules(farm_id: str) -> list[AutomationRule]:
    query = (
        db()
        .collection(Collections.AUTOMATION_RULES)
        .where(filter=FieldFilter("farmId", "==", farm_id))
    )
    rules = [_map_rule(snapshot_data(doc), doc.id) for doc in query.stream()]
    return [rule for rule in rules if rule is not None]


def save_automation_rule(rule: AutomationRule) -> AutomationRule:
    data = rule.model_dump(by_alias=True, exclude={"id"})
    data["updatedAt"] = utcnow()
    db().collection(Collections.AUTOMATION_RULES).document(rule.id).set(data, merge=True)
    return rule


def delete_automation_rule(rule_id: str) -> None:
    db().collection(Collections.AUTOMATION_RULES).document(rule_id).delete()


# --------------------------------------------------------------------------- #
# Users                                                                         #
# --------------------------------------------------------------------------- #


def _map_user(data: dict[str, Any], doc_id: str) -> User:
    raw_role = data.get("role")
    return User(
        id=doc_id,
        email=str(data.get("email") or ""),
        first_name=data.get("firstName"),
        last_name=data.get("lastName"),
        organisation=data.get("organisation"),
        role=UserRole(raw_role) if raw_role in {r.value for r in UserRole} else UserRole.VIEWER,
        farm_ids=list(data.get("farmIds") or []),
        created_at=to_datetime(data.get("createdAt")),
    )


def get_user(user_id: str) -> User:
    snapshot = db().collection(Collections.USERS).document(user_id).get()
    if not snapshot.exists:
        raise NotFoundError("User profile not found.")
    return _map_user(snapshot_data(snapshot), snapshot.id)


def create_user(payload: UserCreate) -> User:
    data = payload.model_dump(by_alias=True, exclude={"id"})
    data["createdAt"] = utcnow()
    db().collection(Collections.USERS).document(payload.id).set(data, merge=True)
    return get_user(payload.id)


def list_users(farm_id: str) -> list[User]:
    query = (
        db().collection(Collections.USERS).where(filter=FieldFilter("farmIds", "array_contains", farm_id))
    )
    return [_map_user(snapshot_data(doc), doc.id) for doc in query.stream()]


def set_user_role(user_id: str, role: UserRole) -> User:
    db().collection(Collections.USERS).document(user_id).set({"role": role.value}, merge=True)
    return get_user(user_id)


def write_audit_log(farm_id: str, user_id: str, action: str, target: str | None, metadata: dict) -> None:
    db().collection(Collections.AUDIT_LOGS).document().set(
        {
            "farmId": farm_id,
            "userId": user_id,
            "action": action,
            "target": target,
            "timestamp": utcnow(),
            "metadata": metadata,
        }
    )
