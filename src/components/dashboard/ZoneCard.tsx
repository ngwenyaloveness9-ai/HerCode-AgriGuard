import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Citrus, Droplet, Nut, Sprout, Thermometer, Umbrella } from 'lucide-react';
import { cardEntrance } from '@/animations/variants';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ZONE_STATUS_PRESENTATION } from '@/constants/status';
import { CROP_LABEL } from '@/constants/sensors';
import { formatReading, formatRelativeTime, NO_VALUE } from '@/utils/format';
import type { LatestReadings } from '@/types';
import type { EvaluatedZone } from '@/hooks/useZones';

const CROP_ICON = { MACADAMIA: Nut, CITRUS: Citrus } as const;

export function ZoneCard({
  evaluated,
  readings,
  irrigating,
  shadeDeployed,
}: {
  evaluated: EvaluatedZone;
  readings: LatestReadings;
  /** Confirmed device state only — never derived from a pending command. */
  irrigating?: boolean | null;
  shadeDeployed?: boolean | null;
}) {
  const { zone, profile, evaluation } = evaluated;
  const CropIcon = CROP_ICON[zone.cropType] ?? Sprout;
  const moisture = readings.SOIL_MOISTURE;
  const soilTemp = readings.SOIL_TEMPERATURE;
  const ambient = readings.AMBIENT_TEMPERATURE;

  return (
    <motion.article variants={cardEntrance} className="rounded-card border border-forest/8 bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-agri/10 text-agri">
            <CropIcon size={19} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <Link to={`/zones/${zone.id}`} className="block truncate font-display font-semibold text-ink hover:underline">
              {zone.name}
            </Link>
            <p className="truncate text-sm text-ink/55">
              {CROP_LABEL[zone.cropType]}
              {zone.cultivar ? ` · ${zone.cultivar}` : ''}
            </p>
          </div>
        </div>
        <StatusBadge presentation={ZONE_STATUS_PRESENTATION[evaluation.status]} size="sm" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-ink/55">
            <Droplet size={13} aria-hidden="true" /> Soil moisture
          </dt>
          <dd className="mt-0.5 font-medium text-ink">
            {moisture ? formatReading(moisture.value, moisture.unit) : NO_VALUE}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-ink/55">
            <Thermometer size={13} aria-hidden="true" /> Soil temp
          </dt>
          <dd className="mt-0.5 font-medium text-ink">
            {soilTemp ? formatReading(soilTemp.value, soilTemp.unit) : NO_VALUE}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Ambient</dt>
          <dd className="mt-0.5 font-medium text-ink">{ambient ? formatReading(ambient.value, ambient.unit) : NO_VALUE}</dd>
        </div>
        <div>
          <dt className="text-ink/55">Soil type</dt>
          <dd className="mt-0.5 font-medium text-ink">{zone.soilType ?? 'Not configured'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-forest/10 px-2 py-1 text-ink/65">
          <Droplet size={12} aria-hidden="true" />
          {irrigating === null || irrigating === undefined
            ? 'Irrigation unknown'
            : irrigating
              ? 'Irrigating'
              : 'Not irrigating'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-forest/10 px-2 py-1 text-ink/65">
          <Umbrella size={12} aria-hidden="true" />
          {shadeDeployed === null || shadeDeployed === undefined
            ? 'Shade unknown'
            : shadeDeployed
              ? 'Shade deployed'
              : 'Shade retracted'}
        </span>
      </div>

      <footer className="mt-4 border-t border-forest/8 pt-3 text-xs text-ink/50">
        {evaluation.lastReadingAt ? `Last reading ${formatRelativeTime(evaluation.lastReadingAt)}` : 'No telemetry received yet'}
        {evaluation.reason ? <span className="block mt-1">{evaluation.reason}</span> : null}
        {!profile ? <span className="mt-1 block text-warn">No crop profile assigned</span> : null}
      </footer>
    </motion.article>
  );
}
