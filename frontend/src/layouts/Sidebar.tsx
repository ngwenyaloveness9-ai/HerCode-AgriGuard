import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { SIDEBAR_ITEMS } from '@/constants/navigation';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-white/10 bg-canopy text-white/85 lg:flex"
    >
      <div className="flex h-16 items-center gap-2.5 px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/12">
          <Icons.Leaf size={19} strokeWidth={2} className="text-fresh" aria-hidden="true" />
        </span>
        {!collapsed ? (
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">AgriGuard 3D</span>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ?? Icons.Circle;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fresh',
                  isActive ? 'bg-white/14 font-medium text-white' : 'hover:bg-white/8',
                )
              }
            >
              <Icon size={18} strokeWidth={1.9} className="shrink-0" aria-hidden="true" />
              {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="m-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fresh"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icons.PanelLeft size={18} strokeWidth={1.9} className="shrink-0" aria-hidden="true" />
        {!collapsed ? <span>Collapse</span> : null}
      </button>
    </motion.aside>
  );
}
