import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Box,
  Cpu,
  Droplets,
  Gauge,
  Leaf,
  Menu,
  ShieldCheck,
  SunMedium,
  Thermometer,
  Waves,
} from 'lucide-react';
import { useState } from 'react';
import { SystemFlowDiagram } from '@/components/landing/SystemFlowDiagram';

const NAV = [
  { label: 'Technology', href: '#technology' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Crops', href: '#crops' },
  { label: 'Digital twin', href: '#digital-twin' },
  { label: 'Sustainability', href: '#sustainability' },
  { label: 'About', href: '#about' },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* ---------------------------------------------------------- Navbar */}
      <header className="sticky top-0 z-40 border-b border-forest/8 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-canopy">
              <Leaf size={19} strokeWidth={2} className="text-fresh" aria-hidden="true" />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight">AgriGuard 3D</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-sm text-ink/70 transition-colors hover:text-forest">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link
              to="/login"
              className="rounded-pill px-3.5 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-forest/6"
            >
              Log in
            </Link>
            <Link
              to="/dashboard"
              className="rounded-pill bg-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-agri"
            >
              Open dashboard
            </Link>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink/70 lg:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-forest/8 px-5 py-3 lg:hidden" aria-label="Primary mobile">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-ink/75"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden bg-canopy text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mb-5 inline-flex items-center gap-2 rounded-pill border border-white/20 px-3 py-1 text-xs text-fresh">
              <span className="h-1.5 w-1.5 rounded-full bg-fresh" aria-hidden="true" />
              Built for macadamia and citrus growers in Mpumalanga
            </p>

            <h1 className="font-display text-display-xl font-semibold">Intelligence Beneath Every Leaf.</h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Solar-powered sensors read the root zone of every block, irrigation responds to what the soil actually
              needs, and a live 3D twin shows you the orchard as it stands right now — not as it was this morning.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="rounded-pill bg-fresh px-6 py-3 font-semibold text-forest transition-colors hover:bg-leaf"
              >
                Set up your farm
              </Link>
              <a
                href="#how-it-works"
                className="rounded-pill border border-white/25 px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
          </motion.div>

          <SystemFlowDiagram />
        </div>
      </section>

      {/* --------------------------------------------------------- Problem */}
      <section className="mx-auto max-w-6xl px-5 py-20" id="technology">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-display-lg font-semibold">
              Irrigation decisions are usually made without knowing the root zone
            </h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              Most orchards are watered on a schedule set weeks earlier, adjusted by feel. A hot week passes before
              anyone notices stress in the canopy, and by then the tree has already paid for it. Water is expensive,
              electricity is unreliable, and the block furthest from the pump house is the one nobody checks.
            </p>
          </div>
          <div>
            <h2 className="font-display text-display-lg font-semibold">So AgriGuard measures instead of estimating</h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              An ESP32 controller at the edge of the orchard reads soil moisture, root-zone and ambient temperature,
              humidity, light, reservoir level and flow. It runs off its own solar panel and battery, so it keeps
              reporting when the grid does not. Every threshold that drives a decision is set by your agronomist, per
              block, per crop — not by the software.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Gauge, title: 'Root-zone moisture', body: 'Continuous readings from each block, calibrated to your soil type and rooting depth.' },
            { icon: Thermometer, title: 'Heat and humidity', body: 'Ambient and soil temperature tracked against the stress thresholds you configure.' },
            { icon: Droplets, title: 'Water accounting', body: 'Flow and reservoir sensors record what each irrigation event actually used.' },
            { icon: SunMedium, title: 'Solar and battery', body: 'Panel output and battery state, so you know the controller will still be awake tonight.' },
          ].map((item) => (
            <article key={item.title} className="rounded-card border border-forest/8 bg-card p-5 shadow-card">
              <item.icon size={20} strokeWidth={1.8} className="text-agri" aria-hidden="true" />
              <h3 className="mt-3 font-medium">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- How it works */}
      <section className="border-y border-forest/8 bg-white" id="how-it-works">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-display-lg font-semibold">From sensor to valve</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink/70">
            The path a reading takes is short and auditable, and every step is recorded.
          </p>

          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {[
              { step: 'Sense', body: 'Probes in each zone report to the ESP32 on a fixed interval.' },
              { step: 'Transmit', body: 'Readings travel to Firebase, directly or through the Node.js service.' },
              { step: 'Evaluate', body: 'Each reading is checked against the crop profile assigned to that zone.' },
              { step: 'Act', body: 'When a rule fires, the valve and pump commands are queued for the controller.' },
              { step: 'Confirm', body: 'The screen shows the pump running only once the device confirms it is.' },
            ].map((item, index) => (
              <li key={item.step} className="border-t-2 border-leaf pt-4">
                <span className="font-mono text-xs text-agri">Step {index + 1}</span>
                <h3 className="mt-1 font-display text-lg font-semibold">{item.step}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- Crops */}
      <section className="mx-auto max-w-6xl px-5 py-20" id="crops">
        <h2 className="font-display text-display-lg font-semibold">Two crops, two sets of rules</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink/70">
          Macadamia and citrus do not want the same soil-water conditions, and a block of young trees does not want what
          a mature block wants. AgriGuard never applies one moisture figure across the farm.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="rounded-card border border-forest/8 bg-card p-7 shadow-card">
            <h3 className="font-display text-xl font-semibold">Macadamia</h3>
            <p className="mt-3 leading-relaxed text-ink/70">
              Shallow, sensitive roots and a low tolerance for waterlogging make both directions dangerous. The platform
              watches root-zone moisture, irrigation demand, heat stress, waterlogging risk and prolonged dry spells
              against the profile your agronomist sets for the cultivar, age and soil.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink/65">
              <li>Irrigation frequency and duration per block</li>
              <li>Waterlogging and prolonged-dryness flags</li>
              <li>Heat-stress tracking with automatic shade response</li>
            </ul>
          </article>

          <article className="rounded-card border border-forest/8 bg-card p-7 shadow-card">
            <h3 className="font-display text-xl font-semibold">Citrus</h3>
            <p className="mt-3 leading-relaxed text-ink/70">
              Citrus rewards consistency. The platform tracks root-zone moisture, excessive dryness and wetness,
              temperature stress and humidity, and keeps the historical trend so you can see whether this season is
              actually drier than the last or it only feels that way.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink/65">
              <li>Water consumption per block and per event</li>
              <li>Season-on-season environmental comparison</li>
              <li>Reservoir availability against demand</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ---------------------------------------------------- Digital twin */}
      <section className="bg-canopy text-white" id="digital-twin">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <Box size={26} strokeWidth={1.7} className="text-fresh" aria-hidden="true" />
            <h2 className="mt-4 font-display text-display-lg font-semibold">A twin that only shows what is true</h2>
            <p className="mt-5 leading-relaxed text-white/75">
              The 3D view renders your configured blocks, and each one carries its live status. Water animates through a
              line when that valve is confirmed open. The reservoir's water height follows the ultrasonic sensor. The
              pump turns when the pump is turning. If the controller goes quiet, the twin says so rather than continuing
              to play yesterday's loop.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Waves, title: 'Live irrigation', body: 'Flow renders only on confirmed valve state.' },
              { icon: Cpu, title: 'Device presence', body: 'A silent ESP32 greys out the block it serves.' },
              { icon: Thermometer, title: 'Heat overlay', body: 'Stress appears when readings cross your threshold.' },
              { icon: ShieldCheck, title: 'Touch controls', body: 'Orbit, zoom and tap a block on any device.' },
            ].map((item) => (
              <article key={item.title} className="rounded-card border border-white/12 bg-white/[0.06] p-5">
                <item.icon size={19} strokeWidth={1.8} className="text-fresh" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-medium">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Sustainability */}
      <section className="mx-auto max-w-6xl px-5 py-20" id="sustainability">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-display-lg font-semibold">Water you can account for</h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              Every irrigation event is stored with its duration, the volume the flow meter recorded, and the moisture
              reading before and after. That record is what the water-usage report is built from, which means the number
              you hand to an auditor is the number the meter produced.
            </p>
          </div>
          <div className="rounded-card border border-forest/8 bg-card p-7 shadow-card">
            <h3 className="font-display text-lg font-semibold">Running on its own power</h3>
            <p className="mt-3 leading-relaxed text-ink/70">
              The controller, sensors and valve drivers run from a solar panel and battery sized for the site. Solar
              generation and battery state are logged like any other measurement, so a week of cloud shows up as data
              rather than as an unexplained gap in your telemetry.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section className="border-t border-forest/8 bg-white" id="about">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-display-lg font-semibold">Start with one block</h2>
          <p className="mt-4 leading-relaxed text-ink/70">
            Register your farm, add a field, define your first zone and its crop profile, then pair the controller. The
            dashboard fills in as soon as the first reading arrives.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-pill bg-forest px-6 py-3 font-semibold text-white transition-colors hover:bg-agri"
            >
              Create an account
            </Link>
            <Link
              to="/login"
              className="rounded-pill border border-forest/20 px-6 py-3 font-medium text-forest transition-colors hover:bg-forest/5"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-canopy px-5 py-12 text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-white">
            <Leaf size={18} className="text-fresh" aria-hidden="true" />
            <span className="font-display font-semibold">AgriGuard 3D</span>
          </div>
          <p className="text-sm">Precision irrigation and climate defence for Mpumalanga orchards.</p>
        </div>
      </footer>
    </div>
  );
}
