import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from '@/layouts/Sidebar';
import { MobileNav } from '@/layouts/MobileNav';
import { TopBar } from '@/layouts/TopBar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ConfigurationNotice } from '@/components/common/ConfigurationNotice';
import { pageTransition } from '@/animations/variants';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <ConfigurationNotice />

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
