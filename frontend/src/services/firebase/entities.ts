import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, getDb } from '@/firebase/config';
import { toISO, toNumber } from '@/firebase/converters';
import type {
  AlertRepository,
  AutomationRepository,
  CropProfileRepository,
  DeviceRepository,
  EnergyRepository,
  FarmRepository,
  IrrigationRepository,
  Unsubscribe,
  UserRepository,
  ZoneRepository,
} from '@/services/repositories';
import type {
  ActuatorCommand,
  Alert,
  AutomationRule,
  BatteryReading,
  CropProfile,
  Device,
  Farm,
  Field,
  FlowReading,
  IrrigationEvent,
  ReservoirConfig,
  ReservoirReading,
  ShadeEvent,
  SolarReading,
  SystemHealth,
  User,
  Zone,
} from '@/types';

const db = () => getDb();

/* ---------------------------------------------------------------- */

function mapFarm(data: Record<string, unknown>, id: string): Farm {
  return {
    id,
    name: String(data.name ?? 'Unnamed farm'),
    organisation: data.organisation ? String(data.organisation) : undefined,
    region: data.region ? String(data.region) : undefined,
    timezone: data.timezone ? String(data.timezone) : undefined,
    coordinates:
      toNumber(data.latitude) !== undefined && toNumber(data.longitude) !== undefined
        ? { latitude: Number(data.latitude), longitude: Number(data.longitude) }
        : undefined,
    createdAt: toISO(data.createdAt) ?? new Date(0).toISOString(),
  };
}

export class FirebaseFarmRepository implements FarmRepository {
  async listFarms(userId: string): Promise<Farm[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.farms), where('memberIds', 'array-contains', userId)));
    return snap.docs.map((d) => mapFarm(d.data(), d.id));
  }

  async getFarm(farmId: string): Promise<Farm | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.farms, farmId));
    return snap.exists() ? mapFarm(snap.data(), snap.id) : null;
  }

  async createFarm(farm: Omit<Farm, 'id' | 'createdAt'>): Promise<Farm> {
    const ref = await addDoc(collection(db(), COLLECTIONS.farms), { ...farm, createdAt: serverTimestamp() });
    const created = await getDoc(ref);
    return mapFarm(created.data() ?? {}, ref.id);
  }

  async listFields(farmId: string): Promise<Field[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.fields), where('farmId', '==', farmId)));
    return snap.docs.map((d) => ({
      id: d.id,
      farmId,
      name: String(d.data().name ?? 'Unnamed field'),
      areaHectares: toNumber(d.data().areaHectares),
      createdAt: toISO(d.data().createdAt) ?? new Date(0).toISOString(),
    }));
  }

  async createField(field: Omit<Field, 'id' | 'createdAt'>): Promise<Field> {
    const ref = await addDoc(collection(db(), COLLECTIONS.fields), { ...field, createdAt: serverTimestamp() });
    return { ...field, id: ref.id, createdAt: new Date().toISOString() };
  }
}

/* ---------------------------------------------------------------- */

function mapZone(data: Record<string, unknown>, id: string): Zone {
  return {
    id,
    farmId: String(data.farmId ?? ''),
    fieldId: data.fieldId ? String(data.fieldId) : undefined,
    name: String(data.name ?? 'Unnamed zone'),
    cropType: (data.cropType as Zone['cropType']) ?? 'MACADAMIA',
    cultivar: data.cultivar ? String(data.cultivar) : undefined,
    growthStage: data.growthStage ? String(data.growthStage) : undefined,
    soilType: data.soilType ? String(data.soilType) : undefined,
    cropProfileId: data.cropProfileId ? String(data.cropProfileId) : undefined,
    rootZoneDepthCm: toNumber(data.rootZoneDepthCm),
    irrigationMethod: data.irrigationMethod ? String(data.irrigationMethod) : undefined,
    // Status is recalculated client-side from readings + profile; the stored
    // value is only a fallback for zones with no telemetry yet.
    status: (data.status as Zone['status']) ?? 'UNKNOWN',
    sensors: Array.isArray(data.sensors) ? (data.sensors as string[]) : [],
    actuators: Array.isArray(data.actuators) ? (data.actuators as string[]) : [],
    lastUpdated: toISO(data.lastUpdated),
  };
}

export class FirebaseZoneRepository implements ZoneRepository {
  async listZones(farmId: string, fieldId?: string): Promise<Zone[]> {
    const constraints = [where('farmId', '==', farmId)];
    if (fieldId) constraints.push(where('fieldId', '==', fieldId));
    const snap = await getDocs(query(collection(db(), COLLECTIONS.zones), ...constraints));
    return snap.docs.map((d) => mapZone(d.data(), d.id));
  }

  async getZone(zoneId: string): Promise<Zone | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.zones, zoneId));
    return snap.exists() ? mapZone(snap.data(), snap.id) : null;
  }

  async createZone(zone: Omit<Zone, 'id' | 'status'>): Promise<Zone> {
    const ref = await addDoc(collection(db(), COLLECTIONS.zones), { ...zone, status: 'UNKNOWN' });
    return { ...zone, id: ref.id, status: 'UNKNOWN' };
  }

  async updateZone(zoneId: string, patch: Partial<Zone>): Promise<Zone> {
    await updateDoc(doc(db(), COLLECTIONS.zones, zoneId), patch);
    const updated = await this.getZone(zoneId);
    if (!updated) throw new Error('Zone not found after update');
    return updated;
  }

  subscribeToZones(farmId: string, onChange: (zones: Zone[]) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.zones), where('farmId', '==', farmId)),
      (snap) => onChange(snap.docs.map((d) => mapZone(d.data(), d.id))),
      (e) => onError(e as Error),
    );
  }
}

/* ---------------------------------------------------------------- */

function mapProfile(data: Record<string, unknown>, id: string): CropProfile {
  // Numeric thresholds are copied through only when present. An absent
  // threshold stays absent — it is never replaced with a literature default.
  const num = (key: string) => toNumber(data[key]);
  return {
    id,
    farmId: String(data.farmId ?? ''),
    name: String(data.name ?? 'Unnamed profile'),
    cropType: (data.cropType as CropProfile['cropType']) ?? 'MACADAMIA',
    cultivar: data.cultivar ? String(data.cultivar) : undefined,
    growthStage: data.growthStage ? String(data.growthStage) : undefined,
    soilType: data.soilType ? String(data.soilType) : undefined,
    rootZoneDepthCm: num('rootZoneDepthCm'),
    irrigationMethod: data.irrigationMethod ? String(data.irrigationMethod) : undefined,
    moistureMeasurementType: data.moistureMeasurementType as CropProfile['moistureMeasurementType'],
    moistureMin: num('moistureMin'),
    moistureTargetLow: num('moistureTargetLow'),
    moistureTargetHigh: num('moistureTargetHigh'),
    moistureCriticalLow: num('moistureCriticalLow'),
    moistureExcessHigh: num('moistureExcessHigh'),
    temperatureMin: num('temperatureMin'),
    temperatureTargetLow: num('temperatureTargetLow'),
    temperatureTargetHigh: num('temperatureTargetHigh'),
    temperatureCriticalHigh: num('temperatureCriticalHigh'),
    humidityTargetLow: num('humidityTargetLow'),
    humidityTargetHigh: num('humidityTargetHigh'),
    lightThreshold: num('lightThreshold'),
    irrigationStartThreshold: num('irrigationStartThreshold'),
    irrigationStopThreshold: num('irrigationStopThreshold'),
    shadeActivationTemperature: num('shadeActivationTemperature'),
    shadeDeactivationTemperature: num('shadeDeactivationTemperature'),
    updatedAt: toISO(data.updatedAt),
    updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
  };
}

export class FirebaseCropProfileRepository implements CropProfileRepository {
  async listProfiles(farmId: string): Promise<CropProfile[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.cropProfiles), where('farmId', '==', farmId)));
    return snap.docs.map((d) => mapProfile(d.data(), d.id));
  }

  async getProfile(profileId: string): Promise<CropProfile | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.cropProfiles, profileId));
    return snap.exists() ? mapProfile(snap.data(), snap.id) : null;
  }

  async saveProfile(profile: CropProfile): Promise<CropProfile> {
    await setDoc(doc(db(), COLLECTIONS.cropProfiles, profile.id), { ...profile, updatedAt: serverTimestamp() }, { merge: true });
    const saved = await this.getProfile(profile.id);
    if (!saved) throw new Error('Crop profile not found after save');
    return saved;
  }
}

/* ---------------------------------------------------------------- */

function mapDevice(data: Record<string, unknown>, id: string): Device {
  return {
    id,
    farmId: String(data.farmId ?? ''),
    zoneId: data.zoneId ? String(data.zoneId) : undefined,
    name: String(data.name ?? id),
    deviceType: (data.deviceType as Device['deviceType']) ?? 'ESP32',
    // Never default to ONLINE. Absence of health data means UNKNOWN.
    status: (data.status as Device['status']) ?? 'UNKNOWN',
    lastSeen: toISO(data.lastSeen),
    firmwareVersion: data.firmwareVersion ? String(data.firmwareVersion) : undefined,
    batteryPercent: toNumber(data.batteryPercent),
    signalStrengthDbm: toNumber(data.signalStrengthDbm),
  };
}

export class FirebaseDeviceRepository implements DeviceRepository {
  async listDevices(farmId: string): Promise<Device[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.devices), where('farmId', '==', farmId)));
    return snap.docs.map((d) => mapDevice(d.data(), d.id));
  }

  async getDevice(deviceId: string): Promise<Device | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.devices, deviceId));
    return snap.exists() ? mapDevice(snap.data(), snap.id) : null;
  }

  async getSystemHealth(farmId: string): Promise<SystemHealth | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.systemHealth, farmId));
    if (!snap.exists()) return null;
    return mapHealth(snap.data());
  }

  subscribeToSystemHealth(farmId: string, onChange: (h: SystemHealth) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(db(), COLLECTIONS.systemHealth, farmId),
      (snap) => {
        if (snap.exists()) onChange(mapHealth(snap.data()));
      },
      (e) => onError(e as Error),
    );
  }
}

function mapHealth(data: Record<string, unknown>): SystemHealth {
  const components = Array.isArray(data.components) ? (data.components as Record<string, unknown>[]) : [];
  return {
    components: components.map((c) => ({
      deviceId: String(c.deviceId ?? ''),
      status: (c.status as SystemHealth['backend']) ?? 'UNKNOWN',
      lastSeen: toISO(c.lastSeen),
      message: c.message ? String(c.message) : undefined,
    })),
    backend: (data.backend as SystemHealth['backend']) ?? 'UNKNOWN',
    database: (data.database as SystemHealth['database']) ?? 'UNKNOWN',
    network: (data.network as SystemHealth['network']) ?? 'UNKNOWN',
    reportedAt: toISO(data.reportedAt),
  };
}

/* ---------------------------------------------------------------- */

export class FirebaseIrrigationRepository implements IrrigationRepository {
  async listEvents(
    farmId: string,
    params?: { zoneId?: string; from?: string; to?: string; limit?: number },
  ): Promise<IrrigationEvent[]> {
    const constraints = [where('farmId', '==', farmId)];
    if (params?.zoneId) constraints.push(where('zoneId', '==', params.zoneId));
    if (params?.from) constraints.push(where('startedAt', '>=', new Date(params.from)));
    if (params?.to) constraints.push(where('startedAt', '<=', new Date(params.to)));
    const snap = await getDocs(
      query(collection(db(), COLLECTIONS.irrigationEvents), ...constraints, orderBy('startedAt', 'desc'), fbLimit(params?.limit ?? 100)),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        farmId,
        zoneId: String(data.zoneId ?? ''),
        startedAt: toISO(data.startedAt) ?? new Date(0).toISOString(),
        endedAt: toISO(data.endedAt),
        durationSeconds: toNumber(data.durationSeconds),
        volumeLitres: toNumber(data.volumeLitres),
        trigger: (data.trigger as IrrigationEvent['trigger']) ?? 'AUTOMATION',
        startMoisture: toNumber(data.startMoisture),
        endMoisture: toNumber(data.endMoisture),
        initiatedBy: data.initiatedBy ? String(data.initiatedBy) : undefined,
      };
    });
  }

  async getActiveSession(farmId: string, zoneId?: string): Promise<IrrigationEvent | null> {
    const constraints = [where('farmId', '==', farmId), where('endedAt', '==', null)];
    if (zoneId) constraints.push(where('zoneId', '==', zoneId));
    const snap = await getDocs(query(collection(db(), COLLECTIONS.irrigationEvents), ...constraints, fbLimit(1)));
    const first = snap.docs[0];
    if (!first) return null;
    const [event] = await this.listEvents(farmId, { zoneId, limit: 1 });
    return event ?? null;
  }

  async listShadeEvents(farmId: string, zoneId?: string): Promise<ShadeEvent[]> {
    const constraints = [where('farmId', '==', farmId)];
    if (zoneId) constraints.push(where('zoneId', '==', zoneId));
    const snap = await getDocs(query(collection(db(), COLLECTIONS.shadeEvents), ...constraints, orderBy('timestamp', 'desc'), fbLimit(100)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        farmId,
        zoneId: String(data.zoneId ?? ''),
        action: (data.action as ShadeEvent['action']) ?? 'DEPLOYED',
        timestamp: toISO(data.timestamp) ?? new Date(0).toISOString(),
        triggerTemperature: toNumber(data.triggerTemperature),
        trigger: (data.trigger as ShadeEvent['trigger']) ?? 'AUTOMATION',
      };
    });
  }

  async getReservoirConfig(farmId: string): Promise<ReservoirConfig | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.reservoirConfig, farmId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      farmId,
      capacityLitres: toNumber(data.capacityLitres),
      heightCm: toNumber(data.heightCm),
      sensorOffsetCm: toNumber(data.sensorOffsetCm),
      lowLevelPercent: toNumber(data.lowLevelPercent),
      criticalLevelPercent: toNumber(data.criticalLevelPercent),
    };
  }

  async getLatestReservoirReading(farmId: string): Promise<ReservoirReading | null> {
    const snap = await getDocs(
      query(collection(db(), COLLECTIONS.reservoirReadings), where('farmId', '==', farmId), orderBy('timestamp', 'desc'), fbLimit(1)),
    );
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data();
    const timestamp = toISO(data.timestamp);
    if (!timestamp) return null;
    return {
      id: first.id,
      farmId,
      levelPercent: toNumber(data.levelPercent),
      distanceCm: toNumber(data.distanceCm),
      estimatedLitres: toNumber(data.estimatedLitres),
      timestamp,
      quality: (data.quality as ReservoirReading['quality']) ?? 'GOOD',
    };
  }

  async getLatestFlowReading(farmId: string, zoneId?: string): Promise<FlowReading | null> {
    const constraints = [where('farmId', '==', farmId)];
    if (zoneId) constraints.push(where('zoneId', '==', zoneId));
    const snap = await getDocs(query(collection(db(), COLLECTIONS.flowReadings), ...constraints, orderBy('timestamp', 'desc'), fbLimit(1)));
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data();
    const litresPerMinute = toNumber(data.litresPerMinute);
    const timestamp = toISO(data.timestamp);
    if (litresPerMinute === undefined || !timestamp) return null;
    return { id: first.id, farmId, zoneId, litresPerMinute, timestamp };
  }

  /**
   * Writes a command document for the backend/ESP32 to pick up. The returned
   * state is SENDING — confirmation only arrives through subscribeToCommand.
   */
  async sendCommand(params: {
    farmId: string;
    zoneId?: string;
    deviceId: string;
    action: ActuatorCommand['action'];
  }): Promise<ActuatorCommand> {
    const payload = {
      ...params,
      state: 'SENDING' as const,
      issuedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db(), COLLECTIONS.commands), payload);
    return {
      id: ref.id,
      farmId: params.farmId,
      zoneId: params.zoneId,
      deviceId: params.deviceId,
      action: params.action,
      state: 'SENDING',
      issuedBy: '',
      issuedAt: new Date().toISOString(),
    };
  }

  subscribeToCommand(commandId: string, onChange: (c: ActuatorCommand) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      doc(db(), COLLECTIONS.commands, commandId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        onChange({
          id: snap.id,
          farmId: String(data.farmId ?? ''),
          zoneId: data.zoneId ? String(data.zoneId) : undefined,
          deviceId: String(data.deviceId ?? ''),
          action: data.action as ActuatorCommand['action'],
          state: (data.state as ActuatorCommand['state']) ?? 'WAITING_FOR_DEVICE',
          issuedBy: String(data.issuedBy ?? ''),
          issuedAt: toISO(data.issuedAt) ?? new Date().toISOString(),
          confirmedAt: toISO(data.confirmedAt),
          failureReason: data.failureReason ? String(data.failureReason) : undefined,
        });
      },
      (e) => onError(e as Error),
    );
  }
}

/* ---------------------------------------------------------------- */

export class FirebaseEnergyRepository implements EnergyRepository {
  async getLatestSolarReading(farmId: string): Promise<SolarReading | null> {
    const snap = await getDocs(
      query(collection(db(), COLLECTIONS.solarReadings), where('farmId', '==', farmId), orderBy('timestamp', 'desc'), fbLimit(1)),
    );
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data();
    const timestamp = toISO(data.timestamp);
    if (!timestamp) return null;
    return {
      id: first.id,
      farmId,
      voltage: toNumber(data.voltage),
      current: toNumber(data.current),
      powerWatts: toNumber(data.powerWatts),
      timestamp,
    };
  }

  async getLatestBatteryReading(farmId: string): Promise<BatteryReading | null> {
    const snap = await getDocs(
      query(collection(db(), COLLECTIONS.batteryReadings), where('farmId', '==', farmId), orderBy('timestamp', 'desc'), fbLimit(1)),
    );
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data();
    const timestamp = toISO(data.timestamp);
    if (!timestamp) return null;
    return {
      id: first.id,
      farmId,
      voltage: toNumber(data.voltage),
      percent: toNumber(data.percent),
      charging: typeof data.charging === 'boolean' ? data.charging : undefined,
      timestamp,
    };
  }
}

/* ---------------------------------------------------------------- */

function mapAlert(data: Record<string, unknown>, id: string): Alert {
  return {
    id,
    farmId: String(data.farmId ?? ''),
    zoneId: data.zoneId ? String(data.zoneId) : undefined,
    cropType: data.cropType as Alert['cropType'],
    category: (data.category as Alert['category']) ?? 'DEVICE',
    severity: (data.severity as Alert['severity']) ?? 'INFO',
    title: String(data.title ?? 'Alert'),
    trigger: String(data.trigger ?? ''),
    measuredValue: toNumber(data.measuredValue),
    configuredThreshold: toNumber(data.configuredThreshold),
    unit: data.unit ? String(data.unit) : undefined,
    systemResponse: data.systemResponse ? String(data.systemResponse) : undefined,
    timestamp: toISO(data.timestamp) ?? new Date(0).toISOString(),
    resolvedAt: toISO(data.resolvedAt),
    resolvedBy: data.resolvedBy ? String(data.resolvedBy) : undefined,
  };
}

export class FirebaseAlertRepository implements AlertRepository {
  async listAlerts(farmId: string, params?: { resolved?: boolean; limit?: number }): Promise<Alert[]> {
    const constraints = [where('farmId', '==', farmId)];
    if (params?.resolved === false) constraints.push(where('resolvedAt', '==', null));
    const snap = await getDocs(
      query(collection(db(), COLLECTIONS.alerts), ...constraints, orderBy('timestamp', 'desc'), fbLimit(params?.limit ?? 200)),
    );
    return snap.docs.map((d) => mapAlert(d.data(), d.id));
  }

  subscribeToAlerts(farmId: string, onChange: (alerts: Alert[]) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db(), COLLECTIONS.alerts), where('farmId', '==', farmId), orderBy('timestamp', 'desc'), fbLimit(200)),
      (snap) => onChange(snap.docs.map((d) => mapAlert(d.data(), d.id))),
      (e) => onError(e as Error),
    );
  }

  async resolveAlert(alertId: string, userId: string): Promise<Alert> {
    await updateDoc(doc(db(), COLLECTIONS.alerts, alertId), { resolvedAt: serverTimestamp(), resolvedBy: userId });
    const snap = await getDoc(doc(db(), COLLECTIONS.alerts, alertId));
    return mapAlert(snap.data() ?? {}, alertId);
  }
}

/* ---------------------------------------------------------------- */

export class FirebaseAutomationRepository implements AutomationRepository {
  async listRules(farmId: string): Promise<AutomationRule[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.automationRules), where('farmId', '==', farmId)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        farmId,
        zoneId: data.zoneId ? String(data.zoneId) : undefined,
        name: String(data.name ?? 'Rule'),
        enabled: Boolean(data.enabled),
        conditionSensor: data.conditionSensor as AutomationRule['conditionSensor'],
        conditionOperator: (data.conditionOperator as AutomationRule['conditionOperator']) ?? 'BELOW',
        conditionThreshold: toNumber(data.conditionThreshold) ?? 0,
        action: data.action as AutomationRule['action'],
        recoveryThreshold: toNumber(data.recoveryThreshold),
        maxRuntimeMinutes: toNumber(data.maxRuntimeMinutes),
        minReservoirPercent: toNumber(data.minReservoirPercent),
        cooldownMinutes: toNumber(data.cooldownMinutes),
        sensorFailureBehaviour: (data.sensorFailureBehaviour as AutomationRule['sensorFailureBehaviour']) ?? 'HALT',
        updatedAt: toISO(data.updatedAt),
      };
    });
  }

  async saveRule(rule: AutomationRule): Promise<AutomationRule> {
    await setDoc(doc(db(), COLLECTIONS.automationRules, rule.id), { ...rule, updatedAt: serverTimestamp() }, { merge: true });
    return rule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    await deleteDoc(doc(db(), COLLECTIONS.automationRules, ruleId));
  }
}

/* ---------------------------------------------------------------- */

export class FirebaseUserRepository implements UserRepository {
  async getProfile(userId: string): Promise<User | null> {
    const snap = await getDoc(doc(db(), COLLECTIONS.users, userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: userId,
      email: String(data.email ?? ''),
      firstName: data.firstName ? String(data.firstName) : undefined,
      lastName: data.lastName ? String(data.lastName) : undefined,
      organisation: data.organisation ? String(data.organisation) : undefined,
      role: (data.role as User['role']) ?? 'VIEWER',
      farmIds: Array.isArray(data.farmIds) ? (data.farmIds as string[]) : [],
      createdAt: toISO(data.createdAt),
    };
  }

  async createProfile(user: Omit<User, 'createdAt'>): Promise<User> {
    await setDoc(doc(db(), COLLECTIONS.users, user.id), { ...user, createdAt: serverTimestamp() });
    return { ...user, createdAt: new Date().toISOString() };
  }

  async listUsers(farmId: string): Promise<User[]> {
    const snap = await getDocs(query(collection(db(), COLLECTIONS.users), where('farmIds', 'array-contains', farmId)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: String(data.email ?? ''),
        firstName: data.firstName ? String(data.firstName) : undefined,
        lastName: data.lastName ? String(data.lastName) : undefined,
        organisation: data.organisation ? String(data.organisation) : undefined,
        role: (data.role as User['role']) ?? 'VIEWER',
        farmIds: Array.isArray(data.farmIds) ? (data.farmIds as string[]) : [],
        createdAt: toISO(data.createdAt),
      };
    });
  }
}
