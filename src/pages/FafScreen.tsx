import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PersonStandingIcon, SearchIcon, ShieldCheckIcon, ClockIcon } from 'lucide-react';
import { friends } from '../data/friends';

type Status = 'idle' | 'searching' | 'connected';

export function FafScreen() {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [matchedId, setMatchedId] = useState('');
  const reduceMotion = useReducedMotion();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    setMatchedId(value.trim().toUpperCase());
    setStatus('searching');
    window.setTimeout(() => setStatus('connected'), 1600);
  };

  const marching = status !== 'connected';
  const travel = reduceMotion ? 0 : 44;

  return (
    <section className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_85%_8%,_rgba(196,181,253,0.85),_transparent_35%),linear-gradient(145deg,_#f5f3ff_0%,_#e9d5ff_48%,_#ddd6fe_100%)] px-4 pb-5 pt-5 dark:bg-[radial-gradient(circle_at_85%_8%,_rgba(109,40,217,0.35),_transparent_35%),linear-gradient(145deg,_#1e1b4b_0%,_#312e81_48%,_#111827_100%)]">
      <header className="px-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Find a Friend
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Pair with someone using their FaF ID to share live status.
        </p>
      </header>

      <div className="mt-4 flex h-36 items-center justify-center overflow-hidden rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-violet-900/10 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/30">
        <div className="flex items-center gap-2">
          <motion.span
            aria-hidden="true"
            animate={marching ? { x: [-travel, 0, -travel] } : { x: 0 }}
            transition={
            marching ?
            { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } :
            { duration: 0.28, ease: [0.23, 1, 0.32, 1] }
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-700 text-white shadow-lg shadow-violet-700/25">
            
            <PersonStandingIcon className="h-7 w-7" />
          </motion.span>

          <motion.span
            aria-hidden="true"
            animate={{ opacity: status === 'connected' ? 1 : 0.3 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-px w-6 bg-slate-400 dark:bg-slate-500" />
          

          <motion.span
            aria-hidden="true"
            animate={marching ? { x: [travel, 0, travel] } : { x: 0 }}
            transition={
            marching ?
            { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } :
            { duration: 0.28, ease: [0.23, 1, 0.32, 1] }
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg shadow-slate-900/20 dark:bg-slate-700">
            
            <PersonStandingIcon className="h-7 w-7" />
          </motion.span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 px-1">
        <label
          htmlFor="faf-id"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          
          FaF ID
        </label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true" />
            
            <input
              id="faf-id"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setStatus('idle');
              }}
              placeholder="Enter FaF ID"
              autoComplete="off"
              className="w-full rounded-xl border border-violet-200 bg-white/80 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 ease-out focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500" />
            
          </div>
          <button
            type="submit"
            className="rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:bg-slate-300 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
            disabled={!value.trim()}>
            
            Connect
          </button>
        </div>
        <p
          aria-live="polite"
          className="mt-2 min-h-[1.25rem] text-xs text-slate-500 dark:text-slate-400">
          
          {status === 'searching' && `Reaching ${matchedId}…`}
          {status === 'connected' &&
          <span className="font-medium text-violet-700 dark:text-violet-300">
              Connected to {matchedId} — live status now shared.
            </span>
          }
        </p>
      </form>

      <div className="mt-3 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Your friends
        </h2>
        <ul className="mt-2 space-y-2">
          {friends.map((friend) =>
          <li
            key={friend.id}
            className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3 shadow-sm shadow-violet-900/5 dark:border-white/10 dark:bg-white/[0.04]">
            
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                <PersonStandingIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {friend.alias}
                </p>
                <p className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                  {friend.fafId}
                </p>
              </div>
              <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              friend.status === 'safe' ?
              'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
              'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`
              }>
              
                {friend.status === 'safe' ?
              <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> :

              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              }
                {friend.distance}
              </span>
            </li>
          )}
        </ul>
      </div>
    </section>);

}