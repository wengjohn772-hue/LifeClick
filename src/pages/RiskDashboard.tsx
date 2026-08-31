import { BrainCircuit, Clock3, Footprints, MapPinned, ShieldAlert } from 'lucide-react';
import { CheckInRecord } from '../types/app';

interface RiskDashboardProps {
  checkIns: CheckInRecord[];
  missedClicks: number;
  fakeAlerts: number;
  behaviorScore: number;
  nextCheckInAt: number;
  onFalseAlert: () => void;
}

export function RiskDashboard({ checkIns, missedClicks, fakeAlerts, behaviorScore, nextCheckInAt, onFalseAlert }: RiskDashboardProps) {
  const riskScore = Math.min(100, Math.round(missedClicks * 18 + fakeAlerts * 12 + (100 - behaviorScore) * 0.35));
  const riskLevel = riskScore >= 70 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';
  const riskTone = riskScore >= 70 ? 'text-rose-600 bg-rose-50' : riskScore >= 35 ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50';
  const nextCheckIn = new Date(nextCheckInAt);

  const metrics = [
    { label: 'Missed clicks', value: String(missedClicks), detail: missedClicks ? 'Needs attention' : 'All clear', icon: ShieldAlert },
    { label: 'Behaviour score', value: `${behaviorScore}/100`, detail: 'Higher is safer', icon: BrainCircuit },
    { label: 'False alerts', value: String(fakeAlerts), detail: 'Confirmed reports', icon: ShieldAlert },
    { label: 'Steps', value: 'Unavailable', detail: 'Device data pending', icon: Footprints },
    { label: 'Time pattern', value: nextCheckIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), detail: 'Next check-in', icon: Clock3 },
    { label: 'Location pattern', value: 'Monitoring', detail: 'Live map connected', icon: MapPinned },
  ];

  return (
    <section className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_90%_5%,_rgba(196,181,253,0.85),_transparent_35%),linear-gradient(145deg,_#f5f3ff_0%,_#e9d5ff_48%,_#ddd6fe_100%)] px-4 pb-5 pt-5 dark:bg-[radial-gradient(circle_at_90%_5%,_rgba(109,40,217,0.35),_transparent_35%),linear-gradient(145deg,_#1e1b4b_0%,_#312e81_48%,_#111827_100%)]">
      <header className="px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">AI safety monitor</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Risk dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">A quiet watch over your check-in behaviour.</p>
      </header>

      <div className="mt-4 rounded-3xl border border-white/70 bg-white/65 p-4 shadow-lg shadow-violet-900/10 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/35">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-lg shadow-violet-700/25">
            <BrainCircuit className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">AI risk assessment</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">History, time, movement and location signals</p>
          </div>
          <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${riskTone}`}>{riskLevel}</div>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk score</p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{riskScore}<span className="text-lg text-slate-400">/100</span></p>
          </div>
          <p className="max-w-[145px] text-right text-xs leading-relaxed text-slate-500 dark:text-slate-400">Escalation starts only when repeated signals indicate concern.</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
          <div className={`h-full rounded-full transition-all ${riskScore >= 70 ? 'bg-rose-500' : riskScore >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(5, riskScore)}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm shadow-violet-900/5 dark:border-white/10 dark:bg-white/[0.05]">
              <Icon className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
              <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">{metric.value}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{metric.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.05]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent check-in signal</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{checkIns.length} recorded</span>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {checkIns[0] ? `Last confirmed at ${checkIns[0].at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'No check-in has been recorded yet.'}
        </p>
        <button
          type="button"
          onClick={onFalseAlert}
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Report false alert
        </button>
      </div>
    </section>
  );
}