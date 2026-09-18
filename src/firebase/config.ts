import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase configuration comes exclusively from environment variables.
 * No key or project identifier is committed to this repository.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Set the VITE_FIREBASE_* variables in your environment.',
    );
  }
  app ??= initializeApp(firebaseConfig);
  return app;
}

export const getFirebaseAuth = (): Auth => getAuth(getApp());
export const getDb = (): Firestore => getFirestore(getApp());
export const getFirebaseStorage = (): FirebaseStorage => getStorage(getApp());

/** Collection names, kept in one place so the schema is auditable. */
export const COLLECTIONS = {
  users: 'users',
  farms: 'farms',
  fields: 'fields',
  zones: 'zones',
  cropProfiles: 'cropProfiles',
  devices: 'devices',
  sensors: 'sensors',
  sensorReadings: 'sensorReadings',
  latestReadings: 'latestReadings',
  irrigationEvents: 'irrigationEvents',
  shadeEvents: 'shadeEvents',
  reservoirReadings: 'reservoirReadings',
  reservoirConfig: 'reservoirConfig',
  flowReadings: 'flowReadings',
  solarReadings: 'solarReadings',
  batteryReadings: 'batteryReadings',
  alerts: 'alerts',
  systemHealth: 'systemHealth',
  automationRules: 'automationRules',
  commands: 'commands',
  auditLogs: 'auditLogs',
} as const;
