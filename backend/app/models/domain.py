"""Domain model.

These mirror `src/types/index.ts` in the frontend field for field. Responses
serialise as camelCase so the two sides share one contract.

Every optional field is genuinely optional: an absent agronomic threshold stays
absent rather than picking up a default, because a default here would silently
become an irrigation decision.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True,
        ser_json_timedelta="iso8601",
    )


# --------------------------------------------------------------------------- #
# Enumerations                                                                  #
# --------------------------------------------------------------------------- #


class CropType(StrEnum):
    MACADAMIA = "MACADAMIA"
    CITRUS = "CITRUS"


class ZoneStatus(StrEnum):
    NORMAL = "NORMAL"
    DRY = "DRY"
    CRITICAL_DRY = "CRITICAL_DRY"
    HEAT_STRESS = "HEAT_STRESS"
    EXCESS_MOISTURE = "EXCESS_MOISTURE"
    SENSOR_ERROR = "SENSOR_ERROR"
    OFFLINE = "OFFLINE"
    STALE_DATA = "STALE_DATA"
    UNKNOWN = "UNKNOWN"


class SensorType(StrEnum):
    SOIL_MOISTURE = "SOIL_MOISTURE"
    SOIL_TEMPERATURE = "SOIL_TEMPERATURE"
    AMBIENT_TEMPERATURE = "AMBIENT_TEMPERATURE"
    HUMIDITY = "HUMIDITY"
    LIGHT = "LIGHT"
    RESERVOIR_LEVEL = "RESERVOIR_LEVEL"
    FLOW = "FLOW"
    SOLAR_VOLTAGE = "SOLAR_VOLTAGE"
    SOLAR_CURRENT = "SOLAR_CURRENT"
    BATTERY_VOLTAGE = "BATTERY_VOLTAGE"
    BATTERY_PERCENT = "BATTERY_PERCENT"


class ReadingQuality(StrEnum):
    GOOD = "GOOD"
    SUSPECT = "SUSPECT"
    BAD = "BAD"


class ReadingSource(StrEnum):
    ESP32 = "ESP32"
    BACKEND = "BACKEND"
    MANUAL = "MANUAL"


class DeviceStatus(StrEnum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"
    UNKNOWN = "UNKNOWN"


class DeviceType(StrEnum):
    ESP32 = "ESP32"
    SOIL_MOISTURE_SENSOR = "SOIL_MOISTURE_SENSOR"
    TEMPERATURE_SENSOR = "TEMPERATURE_SENSOR"
    HUMIDITY_SENSOR = "HUMIDITY_SENSOR"
    LIGHT_SENSOR = "LIGHT_SENSOR"
    RESERVOIR_SENSOR = "RESERVOIR_SENSOR"
    FLOW_METER = "FLOW_METER"
    PUMP = "PUMP"
    VALVE = "VALVE"
    SHADE_SERVO = "SHADE_SERVO"
    SOLAR_MONITOR = "SOLAR_MONITOR"


class CommandState(StrEnum):
    IDLE = "IDLE"
    SENDING = "SENDING"
    ACCEPTED = "ACCEPTED"
    WAITING_FOR_DEVICE = "WAITING_FOR_DEVICE"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class ActuatorAction(StrEnum):
    START_IRRIGATION = "START_IRRIGATION"
    STOP_IRRIGATION = "STOP_IRRIGATION"
    OPEN_VALVE = "OPEN_VALVE"
    CLOSE_VALVE = "CLOSE_VALVE"
    DEPLOY_SHADE = "DEPLOY_SHADE"
    RETRACT_SHADE = "RETRACT_SHADE"


class IrrigationTrigger(StrEnum):
    AUTOMATION = "AUTOMATION"
    MANUAL = "MANUAL"
    SCHEDULE = "SCHEDULE"


class AlertSeverity(StrEnum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertCategory(StrEnum):
    MOISTURE = "MOISTURE"
    HEAT = "HEAT"
    WATER = "WATER"
    IRRIGATION = "IRRIGATION"
    SENSOR = "SENSOR"
    DEVICE = "DEVICE"
    ENERGY = "ENERGY"
    CONNECTIVITY = "CONNECTIVITY"


class UserRole(StrEnum):
    ADMINISTRATOR = "ADMINISTRATOR"
    FARM_MANAGER = "FARM_MANAGER"
    AGRONOMIST = "AGRONOMIST"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class ComparisonPeriod(StrEnum):
    TODAY = "TODAY"
    DAY = "DAY"
    WEEK = "WEEK"
    MONTH = "MONTH"
    YEAR = "YEAR"


class Bucket(StrEnum):
    RAW = "raw"
    HOUR = "hour"
    DAY = "day"
    MONTH = "month"


# --------------------------------------------------------------------------- #
# Organisation                                                                  #
# --------------------------------------------------------------------------- #


class Coordinates(Base):
    latitude: float
    longitude: float


class Farm(Base):
    id: str
    name: str
    organisation: str | None = None
    region: str | None = None
    timezone: str | None = None
    coordinates: Coordinates | None = None
    created_at: datetime


class FarmCreate(Base):
    name: str
    organisation: str | None = None
    region: str | None = None
    timezone: str | None = None
    coordinates: Coordinates | None = None


class Field_(Base):
    id: str
    farm_id: str
    name: str
    area_hectares: float | None = None
    created_at: datetime


class FieldCreate(Base):
    farm_id: str
    name: str
    area_hectares: float | None = None


class Zone(Base):
    id: str
    farm_id: str
    field_id: str | None = None
    name: str
    crop_type: CropType
    cultivar: str | None = None
    growth_stage: str | None = None
    soil_type: str | None = None
    crop_profile_id: str | None = None
    root_zone_depth_cm: float | None = None
    irrigation_method: str | None = None
    status: ZoneStatus = ZoneStatus.UNKNOWN
    sensors: list[str] = Field(default_factory=list)
    actuators: list[str] = Field(default_factory=list)
    last_updated: datetime | None = None


class ZoneCreate(Base):
    farm_id: str
    field_id: str | None = None
    name: str
    crop_type: CropType
    cultivar: str | None = None
    growth_stage: str | None = None
    soil_type: str | None = None
    crop_profile_id: str | None = None
    root_zone_depth_cm: float | None = None
    irrigation_method: str | None = None
    sensors: list[str] = Field(default_factory=list)
    actuators: list[str] = Field(default_factory=list)


class ZoneUpdate(Base):
    name: str | None = None
    crop_type: CropType | None = None
    cultivar: str | None = None
    growth_stage: str | None = None
    soil_type: str | None = None
    crop_profile_id: str | None = None
    root_zone_depth_cm: float | None = None
    irrigation_method: str | None = None
    sensors: list[str] | None = None
    actuators: list[str] | None = None


# --------------------------------------------------------------------------- #
# Agronomy                                                                      #
# --------------------------------------------------------------------------- #


class CropProfile(Base):
    """Agronomist-defined thresholds.

    Nothing here has a default. A profile that omits ``moisture_critical_low``
    means "not configured", and the evaluator declines to judge that condition
    rather than inventing a number.
    """

    id: str
    farm_id: str
    name: str
    crop_type: CropType
    cultivar: str | None = None
    growth_stage: str | None = None
    soil_type: str | None = None
    root_zone_depth_cm: float | None = None
    irrigation_method: str | None = None
    moisture_measurement_type: str | None = None

    moisture_min: float | None = None
    moisture_target_low: float | None = None
    moisture_target_high: float | None = None
    moisture_critical_low: float | None = None
    moisture_excess_high: float | None = None

    temperature_min: float | None = None
    temperature_target_low: float | None = None
    temperature_target_high: float | None = None
    temperature_critical_high: float | None = None

    humidity_target_low: float | None = None
    humidity_target_high: float | None = None

    light_threshold: float | None = None

    irrigation_start_threshold: float | None = None
    irrigation_stop_threshold: float | None = None

    shade_activation_temperature: float | None = None
    shade_deactivation_temperature: float | None = None

    updated_at: datetime | None = None
    updated_by: str | None = None


# --------------------------------------------------------------------------- #
# Telemetry                                                                     #
# --------------------------------------------------------------------------- #


class SensorReading(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    sensor_id: str
    sensor_type: SensorType
    value: float
    unit: str
    timestamp: datetime
    quality: ReadingQuality = ReadingQuality.GOOD
    source: ReadingSource = ReadingSource.ESP32


class ReadingIngest(Base):
    """One measurement as posted by the ESP32."""

    zone_id: str | None = None
    sensor_id: str
    sensor_type: SensorType
    value: float
    unit: str
    timestamp: datetime | None = None
    quality: ReadingQuality = ReadingQuality.GOOD


class TelemetryIngest(Base):
    farm_id: str
    device_id: str
    readings: list[ReadingIngest]


class TimeSeriesPoint(Base):
    timestamp: datetime
    value: float


class TimeSeries(Base):
    sensor_type: SensorType
    zone_id: str | None = None
    unit: str
    points: list[TimeSeriesPoint] = Field(default_factory=list)


class ComparisonResult(Base):
    metric: str
    unit: str
    current_value: float | None = None
    previous_value: float | None = None
    absolute_difference: float | None = None
    percentage_difference: float | None = None
    trend: str = "UNKNOWN"
    sufficient_data: bool = False


# --------------------------------------------------------------------------- #
# Devices                                                                       #
# --------------------------------------------------------------------------- #


class Device(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    name: str
    device_type: DeviceType
    status: DeviceStatus = DeviceStatus.UNKNOWN
    last_seen: datetime | None = None
    firmware_version: str | None = None
    battery_percent: float | None = None
    signal_strength_dbm: float | None = None


class DeviceHealth(Base):
    device_id: str
    status: DeviceStatus = DeviceStatus.UNKNOWN
    last_seen: datetime | None = None
    message: str | None = None


class SystemHealth(Base):
    components: list[DeviceHealth] = Field(default_factory=list)
    backend: DeviceStatus = DeviceStatus.UNKNOWN
    database: DeviceStatus = DeviceStatus.UNKNOWN
    network: DeviceStatus = DeviceStatus.UNKNOWN
    reported_at: datetime | None = None


class ActuatorCommand(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    device_id: str
    action: ActuatorAction
    state: CommandState
    issued_by: str
    issued_at: datetime
    confirmed_at: datetime | None = None
    failure_reason: str | None = None


class CommandCreate(Base):
    farm_id: str
    zone_id: str | None = None
    device_id: str
    action: ActuatorAction


class CommandAck(Base):
    """Posted by the device. This is the only way a command reaches CONFIRMED."""

    state: CommandState
    failure_reason: str | None = None


# --------------------------------------------------------------------------- #
# Operations                                                                    #
# --------------------------------------------------------------------------- #


class IrrigationEvent(Base):
    id: str
    farm_id: str
    zone_id: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    volume_litres: float | None = None
    trigger: IrrigationTrigger = IrrigationTrigger.AUTOMATION
    start_moisture: float | None = None
    end_moisture: float | None = None
    initiated_by: str | None = None


class ShadeEvent(Base):
    id: str
    farm_id: str
    zone_id: str
    action: str
    timestamp: datetime
    trigger_temperature: float | None = None
    trigger: IrrigationTrigger = IrrigationTrigger.AUTOMATION


class ReservoirReading(Base):
    id: str
    farm_id: str
    level_percent: float | None = None
    distance_cm: float | None = None
    estimated_litres: float | None = None
    timestamp: datetime
    quality: ReadingQuality = ReadingQuality.GOOD


class ReservoirConfig(Base):
    farm_id: str
    capacity_litres: float | None = None
    height_cm: float | None = None
    sensor_offset_cm: float | None = None
    low_level_percent: float | None = None
    critical_level_percent: float | None = None


class FlowReading(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    litres_per_minute: float
    timestamp: datetime


class SolarReading(Base):
    id: str
    farm_id: str
    voltage: float | None = None
    current: float | None = None
    power_watts: float | None = None
    timestamp: datetime


class BatteryReading(Base):
    id: str
    farm_id: str
    voltage: float | None = None
    percent: float | None = None
    charging: bool | None = None
    timestamp: datetime


# --------------------------------------------------------------------------- #
# Alerts and automation                                                         #
# --------------------------------------------------------------------------- #


class Alert(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    crop_type: CropType | None = None
    category: AlertCategory
    severity: AlertSeverity
    title: str
    trigger: str
    measured_value: float | None = None
    configured_threshold: float | None = None
    unit: str | None = None
    system_response: str | None = None
    timestamp: datetime
    resolved_at: datetime | None = None
    resolved_by: str | None = None


class AutomationRule(Base):
    id: str
    farm_id: str
    zone_id: str | None = None
    name: str
    enabled: bool = False
    condition_sensor: SensorType
    condition_operator: str = "BELOW"
    condition_threshold: float
    action: ActuatorAction
    recovery_threshold: float | None = None
    max_runtime_minutes: float | None = None
    min_reservoir_percent: float | None = None
    cooldown_minutes: float | None = None
    sensor_failure_behaviour: str = "HALT"
    updated_at: datetime | None = None


# --------------------------------------------------------------------------- #
# People                                                                        #
# --------------------------------------------------------------------------- #


class User(Base):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    organisation: str | None = None
    role: UserRole = UserRole.VIEWER
    farm_ids: list[str] = Field(default_factory=list)
    created_at: datetime | None = None


class UserCreate(Base):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    organisation: str | None = None
    role: UserRole = UserRole.VIEWER
    farm_ids: list[str] = Field(default_factory=list)


class AuditLog(Base):
    id: str
    farm_id: str
    user_id: str
    action: str
    target: str | None = None
    timestamp: datetime
    metadata: dict = Field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Evaluation output                                                             #
# --------------------------------------------------------------------------- #


class ZoneEvaluation(Base):
    zone_id: str
    status: ZoneStatus
    reason: str | None = None
    measured_value: float | None = None
    configured_threshold: float | None = None
    unit: str | None = None
    profile_incomplete: bool = False
    last_reading_at: datetime | None = None
