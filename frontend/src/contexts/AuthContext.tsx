import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseConfigured, getFirebaseAuth } from '@/firebase/config';
import { registerTokenAccessor } from '@/api/client';
import { useRepositories } from '@/services/repositoryProvider';
import type { User, UserRole } from '@/types';

/**
 * Authentication is delegated entirely to Firebase Auth. There is no local
 * success path: a session exists only when Firebase reports one.
 */

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  role: UserRole | null;
  initialising: boolean;
  configured: boolean;
  signIn(email: string, password: string, remember: boolean): Promise<void>;
  register(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organisation: string;
  }): Promise<void>;
  resetPassword(email: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: Permission): boolean;
}

export type Permission = 'CONTROL_ACTUATORS' | 'EDIT_CROP_PROFILES' | 'MANAGE_USERS' | 'EDIT_AUTOMATION' | 'VIEW';

const PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMINISTRATOR: ['CONTROL_ACTUATORS', 'EDIT_CROP_PROFILES', 'MANAGE_USERS', 'EDIT_AUTOMATION', 'VIEW'],
  FARM_MANAGER: ['CONTROL_ACTUATORS', 'EDIT_CROP_PROFILES', 'EDIT_AUTOMATION', 'VIEW'],
  AGRONOMIST: ['EDIT_CROP_PROFILES', 'VIEW'],
  OPERATOR: ['CONTROL_ACTUATORS', 'VIEW'],
  VIEWER: ['VIEW'],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { repositories } = useRepositories();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;
    registerTokenAccessor(async () => getFirebaseAuth().currentUser?.getIdToken() ?? null);

    return onAuthStateChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          setProfile(await repositories.users.getProfile(user.uid));
        } catch {
          // A missing or unreachable profile leaves permissions unresolved
          // rather than granting a default role.
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setInitialising(false);
    });
  }, [repositories]);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const auth = getFirebaseAuth();
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const register = useCallback(
    async (params: { email: string; password: string; firstName: string; lastName: string; organisation: string }) => {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), params.email, params.password);
      await repositories.users.createProfile({
        id: credential.user.uid,
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        organisation: params.organisation,
        role: 'FARM_MANAGER',
        farmIds: [],
      });
    },
    [repositories],
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      role: profile?.role ?? null,
      initialising,
      configured: firebaseConfigured,
      signIn,
      register,
      resetPassword,
      logout,
      can: (permission) => (profile ? PERMISSIONS[profile.role].includes(permission) : false),
    }),
    [firebaseUser, profile, initialising, signIn, register, resetPassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
