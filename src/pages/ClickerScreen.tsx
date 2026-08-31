import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRingIcon, CheckIcon, Clock3Icon } from 'lucide-react';

interface CheckIn {
  id: number;
  at: Date;
}

interface ClickerScreenProps {
  clickMinutes: number;
  remind: boolean;
}

export function ClickerScreen({ clickMinutes, remind }: ClickerScreenProps) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const [nextCheckInAt, setNextCheckInAt] = useState(() => Date.now() + clickMinutes * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());

  const last = checkIns[0];
  const remainingSeconds = Math.max(0, Math.ceil((nextCheckInAt - now) / 1000));
  const totalSeconds = clickMinutes * 60;
  const progress = Math.min(100, Math.max(0, (remainingSeconds / totalSeconds) * 100));

  useEffect(() => {
    setNextCheckInAt(Date.now() + clickMinutes * 60 * 1000);
  }, [clickMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  const handleClick = () => {
    setCheckIns((prev) => [{ id: Date.now(), at: new Date() }, ...prev].slice(0, 5));
    setPulseKey((k) => k + 1);
    setNextCheckInAt(Date.now() + clickMinutes * 60 * 1000);
  };

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_15%_10%,_rgba(196,181,253,0.9),_transparent_38%),linear-gradient(145deg,_#f5f3ff_0%,_#e9d5ff_48%,_#ddd6fe_100%)] px-5 pb-5 pt-5 dark:bg-[radial-gradient(circle_at_15%_10%,_rgba(109,40,217,0.35),_transparent_38%),linear-gradient(145deg,_#1e1b4b_0%,_#312e81_48%,_#111827_100%)]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Check in
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          One tap tells your circle you're okay.
        </p>
      </header>

      <div className="mt-5 rounded-3xl border border-white/70 bg-white/55 p-4 shadow-lg shadow-violet-900/10 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Clock3Icon className="h-4 w-4" aria-hidden="true" />
            Next check-in
          </div>
          <span className="text-xs font-medium text-violet-700 dark:text-violet-200">
            Every {clickMinutes >= 60 ? `${Math.floor(clickMinutes / 60)}h${clickMinutes % 60 ? ` ${clickMinutes % 60}m` : ''}` : `${clickMinutes}m`}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={`font-mono text-3xl font-bold tracking-tight ${remainingSeconds === 0 ? 'text-rose-600' : 'text-violet-950 dark:text-white'}`}>
            {remainingSeconds === 0 ? 'Due now' : formatCountdown(remainingSeconds)}
          </p>
          <p className="flex items-center gap-1 text-xs text-violet-700 dark:text-violet-200">
            <BellRingIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {remind ? 'Reminder on' : 'Reminder off'}
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-200/70 dark:bg-white/10">
          <motion.div
            className={`h-full rounded-full ${remainingSeconds === 0 ? 'bg-rose-500' : 'bg-violet-700 dark:bg-violet-300'}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex h-60 w-60 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute h-60 w-60 rounded-full border border-emerald-500/15 dark:border-emerald-400/15" />
          
          <span
            aria-hidden="true"
            className="absolute h-52 w-52 rounded-full border border-emerald-500/25 dark:border-emerald-400/20" />
          

          <AnimatePresence>
            {pulseKey > 0 &&
            <motion.span
              key={pulseKey}
              aria-hidden="true"
              initial={{ scale: 0.92, opacity: 0.45 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="absolute h-44 w-44 rounded-full bg-emerald-400" />

            }
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={handleClick}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
            className="relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full bg-violet-700 text-white shadow-2xl shadow-violet-700/30 ring-8 ring-violet-500/10 transition-colors duration-150 ease-out hover:bg-violet-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-300">
            
            <span className="text-2xl font-semibold tracking-tight">I'm safe</span>
            <span className="mt-1 text-xs font-medium text-violet-50/80">
              Tap to send
            </span>
          </motion.button>
        </div>

        <div className="mt-8 h-6 text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={last ? last.id : 'none'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="text-sm text-slate-600 dark:text-slate-400">
              
              {last ?
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckIcon className="h-4 w-4" aria-hidden="true" />
                  Sent at{' '}
                  {last.at.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                </span> :

              'No check-in yet today.'
              }
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {checkIns.length > 0 &&
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recent
          </h2>
          <ul className="mt-2 space-y-1.5">
            {checkIns.map((item) =>
          <li
            key={item.id}
            className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            
                <span>I'm safe</span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {item.at.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
                </span>
              </li>
          )}
          </ul>
        </div>
      }
    </section>);

}