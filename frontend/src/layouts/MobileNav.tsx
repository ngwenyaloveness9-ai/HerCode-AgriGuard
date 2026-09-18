import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { cn } from '@/utils/cn';
import { MOBILE_PRIMARY, SIDEBAR_ITEMS } from '@/constants/navigation';

export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const primary = SIDEBAR_ITEMS.filter((item) => MOBILE_PRIMARY.includes(item.to));
  const rest = SIDEBAR_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.to));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-forest/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Main"
      >
        {primary.map((item) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ?? Icons.Circle;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]', isActive ? 'text-agri' : 'text-ink/55')
              }
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              {item.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-ink/55"
        >
          <Icons.Menu size={20} strokeWidth={1.9} aria-hidden="true" />
          More
        </button>
      </nav>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-forest/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-4 pb-8"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="More sections"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" aria-hidden="true" />
              <div className="grid grid-cols-3 gap-2">
                {rest.map((item) => {
                  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ?? Icons.Circle;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className="flex flex-col items-center gap-2 rounded-card border border-forest/8 px-2 py-4 text-xs text-ink/70"
                    >
                      <Icon size={20} strokeWidth={1.8} className="text-agri" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
