import { motion } from 'framer-motion';
import {
  MapIcon,
  ShieldCheckIcon,
  PersonStandingIcon,
  NewspaperIcon,
  SettingsIcon,
} from 'lucide-react';
import { TabId } from '../types/app';

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'clicker', label: 'Clicker', icon: ShieldCheckIcon },
  { id: 'faf', label: 'FaF', icon: PersonStandingIcon },
  { id: 'feeds', label: 'Feeds', icon: NewspaperIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className="shrink-0 border-t border-violet-100 bg-white/90 backdrop-blur-xl dark:border-violet-900/60 dark:bg-slate-950/90"
    >
      <ul role="tablist" className="mx-auto flex max-w-md px-2 pb-2 pt-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;

          return (
            <li key={tab.id} className="flex-1">
              <button
                role="tab"
                type="button"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onChange(tab.id)}
                className="relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    aria-hidden="true"
                    transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-0 rounded-xl bg-violet-100 dark:bg-violet-500/15"
                  />
                )}

                <Icon
                  aria-hidden="true"
                  className={`relative h-5 w-5 transition-colors duration-150 ease-out ${
                    isActive ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400 dark:text-slate-500'
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />

                <span
                  className={`relative text-[10.5px] font-medium leading-none transition-colors duration-150 ease-out ${
                    isActive ? 'text-violet-800 dark:text-violet-300' : 'text-slate-500 dark:text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}