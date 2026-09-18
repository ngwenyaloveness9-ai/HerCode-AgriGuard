export interface NavItem {
  label: string;
  to: string;
  icon: string;
}

export const SIDEBAR_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Digital twin', to: '/digital-twin', icon: 'Box' },
  { label: 'Zones', to: '/zones', icon: 'Grid2x2' },
  { label: 'Irrigation', to: '/irrigation', icon: 'Droplets' },
  { label: 'Reservoir', to: '/reservoir', icon: 'Container' },
  { label: 'Crops', to: '/crops', icon: 'Sprout' },
  { label: 'Analytics', to: '/analytics', icon: 'ChartSpline' },
  { label: 'Energy', to: '/energy', icon: 'SunMedium' },
  { label: 'Alerts', to: '/alerts', icon: 'Bell' },
  { label: 'Devices', to: '/devices', icon: 'Cpu' },
  { label: 'Automation', to: '/automation', icon: 'Workflow' },
  { label: 'Reports', to: '/reports', icon: 'FileText' },
  { label: 'Settings', to: '/settings', icon: 'Settings' },
];

/** Shown in the mobile bottom bar; the rest live behind "More". */
export const MOBILE_PRIMARY = ['/dashboard', '/zones', '/irrigation', '/alerts'];
