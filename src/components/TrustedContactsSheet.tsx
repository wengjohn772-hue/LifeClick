import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, PhoneIcon, StarIcon, PlusIcon } from 'lucide-react';
import { trustedContacts } from '../data/contacts';

interface TrustedContactsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function TrustedContactsSheet({ open, onClose }: TrustedContactsSheetProps) {
  return (
    <AnimatePresence>
      {open &&
      <div className="absolute inset-0 z-50 flex items-end">
          <motion.button
          type="button"
          aria-label="Close trusted contacts"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60" />
        
          <motion.div
          role="dialog"
          aria-label="Trusted contacts"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full rounded-t-3xl border-t border-slate-200 bg-white px-5 pb-6 pt-4 dark:border-white/10 dark:bg-slate-900">
          
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-white/15" />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                  Trusted contacts
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Alerted first when you miss a check-in.
                </p>
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 ease-out hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
              
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {trustedContacts.map((contact) =>
            <li
              key={contact.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {contact.name.
                split(' ').
                map((part) => part[0]).
                join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900 dark:text-white">
                      {contact.name}
                      {contact.isPrimary &&
                  <StarIcon
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                    aria-label="Primary contact" />

                  }
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {contact.relation} · {contact.phone}
                    </p>
                  </div>
                  <a
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                aria-label={`Call ${contact.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm transition-colors duration-150 ease-out hover:bg-emerald-50 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-white/20">
                
                    <PhoneIcon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
            )}
            </ul>

            <button
            type="button"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 transition-colors duration-150 ease-out hover:border-emerald-400 hover:text-emerald-700 dark:border-white/15 dark:text-slate-300 dark:hover:border-emerald-500/60 dark:hover:text-emerald-300">
            
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Add contact
            </button>
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}