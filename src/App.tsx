import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { RepositoryProvider } from '@/services/repositoryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { FarmScopeProvider } from '@/contexts/FarmScopeContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LoadingState } from '@/components/common/DataState';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { PendingPage } from '@/pages/PendingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Routes still in the build queue, so every sidebar link resolves. */
const PENDING_ROUTES: { path: string; title: string; description: string }[] = [
  { path: '/onboarding', title: 'Set up your farm', description: 'Create your farm, fields, zones, crop profiles and controller.' },
  { path: '/zones', title: 'Zones', description: 'Every configured zone, filterable by crop, status and device state.' },
  { path: '/zones/:zoneId', title: 'Zone detail', description: 'Live readings, crop profile, history, irrigation and sensor health.' },
  { path: '/digital-twin', title: 'Digital twin', description: 'A 3D view of the orchard driven by confirmed device state.' },
  { path: '/irrigation', title: 'Irrigation', description: 'Pump and valve state, flow, and manual control with confirmation.' },
  { path: '/reservoir', title: 'Reservoir', description: 'Level, distance, flow and consumption from the ultrasonic sensor.' },
  { path: '/energy', title: 'Solar and energy', description: 'Solar generation, battery state and controller power.' },
  { path: '/crops', title: 'Crop intelligence', description: 'Configured agronomic profiles alongside measured conditions.' },
  { path: '/analytics', title: 'Analytics', description: 'Moisture, temperature, irrigation, water, climate and energy trends.' },
  { path: '/alerts', title: 'Alerts', description: 'Every triggered alert with its measured value and configured threshold.' },
  { path: '/devices', title: 'Devices', description: 'Controller, sensors and actuators with their reported status.' },
  { path: '/automation', title: 'Automation', description: 'Irrigation and shade rules with safety limits and overrides.' },
  { path: '/reports', title: 'Reports', description: 'Daily, weekly, monthly and annual reports built from stored data.' },
  { path: '/settings', title: 'Settings', description: 'Farm, zones, crop profiles, sensors, actuators and users.' },
  { path: '/profile', title: 'Profile', description: 'Your details, security and notification preferences.' },
];

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RepositoryProvider>
          <AuthProvider>
            <FarmScopeProvider>
              {/* Honours prefers-reduced-motion across every animation. */}
              <MotionConfig reducedMotion="user">
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route element={<ProtectedRoute />}>
                      <Route element={<DashboardLayout />}>
                        <Route
                          path="/dashboard"
                          element={
                            <Suspense fallback={<LoadingState label="Loading dashboard" rows={6} />}>
                              <DashboardPage />
                            </Suspense>
                          }
                        />
                        {PENDING_ROUTES.map((route) => (
                          <Route
                            key={route.path}
                            path={route.path}
                            element={<PendingPage title={route.title} description={route.description} />}
                          />
                        ))}
                      </Route>
                    </Route>

                    <Route path="/home" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </BrowserRouter>
              </MotionConfig>
            </FarmScopeProvider>
          </AuthProvider>
        </RepositoryProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
