import { motion, useReducedMotion } from 'framer-motion';

/**
 * Hero illustration: sun -> panel -> controller -> three zones -> irrigation.
 *
 * This is a marketing illustration on the public page, not a data view. It is
 * deliberately schematic and carries no numbers, so it cannot be mistaken for
 * live telemetry.
 */
export function SystemFlowDiagram() {
  const reduceMotion = useReducedMotion();

  const zones = [
    { x: 60, label: 'Zone A' },
    { x: 175, label: 'Zone B' },
    { x: 290, label: 'Zone C' },
  ];

  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-card border border-white/12 bg-white/[0.05] p-5"
    >
      <svg viewBox="0 0 420 330" className="h-auto w-full" role="img" aria-labelledby="flow-title">
        <title id="flow-title">
          Sunlight powers a solar panel, which powers the ESP32 controller. The controller reads sensors in three
          orchard zones and drives the irrigation line.
        </title>

        <defs>
          <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4FC3F7" />
            <stop offset="100%" stopColor="#0288D1" />
          </linearGradient>
          <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#795548" />
            <stop offset="100%" stopColor="#4a332b" />
          </linearGradient>
        </defs>

        {/* Sun */}
        <motion.g
          animate={reduceMotion ? {} : { opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="58" cy="44" r="19" fill="#FBC02D" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={58 + Math.cos(angle) * 25}
                y1={44 + Math.sin(angle) * 25}
                x2={58 + Math.cos(angle) * 32}
                y2={44 + Math.sin(angle) * 32}
                stroke="#FBC02D"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            );
          })}
        </motion.g>

        {/* Sunlight to panel */}
        <motion.line
          x1="76" y1="60" x2="148" y2="86"
          stroke="#FBC02D" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round"
          animate={reduceMotion ? {} : { strokeDashoffset: [0, -20] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />

        {/* Solar panel */}
        <g transform="translate(150 78) skewX(-12)">
          <rect width="86" height="46" rx="3" fill="url(#panelGrad)" />
          <line x1="28.7" y1="0" x2="28.7" y2="46" stroke="#123524" strokeWidth="1.5" opacity="0.5" />
          <line x1="57.3" y1="0" x2="57.3" y2="46" stroke="#123524" strokeWidth="1.5" opacity="0.5" />
          <line x1="0" y1="23" x2="86" y2="23" stroke="#123524" strokeWidth="1.5" opacity="0.5" />
        </g>
        <text x="193" y="142" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11">Solar panel</text>

        {/* Panel to controller */}
        <motion.path
          d="M245 105 C 290 105, 300 118, 318 130"
          fill="none" stroke="#FBC02D" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round"
          animate={reduceMotion ? {} : { strokeDashoffset: [0, -24] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />

        {/* Controller */}
        <g>
          <rect x="316" y="118" width="62" height="46" rx="6" fill="#17231B" stroke="#66BB6A" strokeWidth="1.5" />
          <text x="347" y="146" textAnchor="middle" fill="#66BB6A" fontSize="11" fontFamily="monospace">ESP32</text>
          <motion.circle
            cx="368" cy="128" r="3" fill="#66BB6A"
            animate={reduceMotion ? {} : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </g>

        {/* Soil band */}
        <rect x="20" y="238" width="380" height="72" rx="8" fill="url(#soilGrad)" />

        {/* Irrigation line */}
        <line x1="34" y1="256" x2="386" y2="256" stroke="#0288D1" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
        <motion.line
          x1="34" y1="256" x2="386" y2="256"
          stroke="#4FC3F7" strokeWidth="5" strokeLinecap="round" strokeDasharray="14 22"
          animate={reduceMotion ? {} : { strokeDashoffset: [0, -72] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />

        {/* Controller to zones */}
        {zones.map((zone) => (
          <line
            key={`link-${zone.label}`}
            x1="347" y1="164" x2={zone.x + 34} y2="196"
            stroke="#66BB6A" strokeWidth="1.2" opacity="0.35"
          />
        ))}

        {/* Zones */}
        {zones.map((zone, index) => (
          <g key={zone.label}>
            {/* canopy */}
            <motion.g
              animate={reduceMotion ? {} : { y: [0, -2.5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.7 }}
            >
              <circle cx={zone.x + 34} cy="206" r="26" fill="#2E7D32" />
              <circle cx={zone.x + 20} cy="196" r="17" fill="#4CAF50" />
              <circle cx={zone.x + 48} cy="198" r="15" fill="#66BB6A" />
            </motion.g>
            <rect x={zone.x + 31} y="228" width="6" height="22" rx="2" fill="#4a332b" />

            {/* probe */}
            <line x1={zone.x + 52} y1="252" x2={zone.x + 52} y2="286" stroke="#A1887F" strokeWidth="2.5" strokeLinecap="round" />
            <motion.circle
              cx={zone.x + 52} cy="252" r="3.5" fill="#4FC3F7"
              animate={reduceMotion ? {} : { opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.5 }}
            />

            {/* dripper */}
            <motion.circle
              cx={zone.x + 16} cy="266" r="3" fill="#4FC3F7"
              animate={reduceMotion ? {} : { cy: [258, 286], opacity: [1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeIn', delay: index * 0.4 }}
            />

            <text x={zone.x + 34} y="304" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="11">
              {zone.label}
            </text>
          </g>
        ))}
      </svg>
    </motion.figure>
  );
}
