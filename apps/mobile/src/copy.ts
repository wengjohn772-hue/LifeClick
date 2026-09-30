import type { Brand } from './theme';

/**
 * Per-product wording.
 *
 * Screens that are structurally identical between Individual and Business read
 * their labels from here instead of being copied. That keeps one implementation
 * to fix while both products are under active development, and when the
 * Business app splits off it keeps `businessCopy` and deletes the other — no
 * screen has to be untangled.
 *
 * Anything that differs *structurally* belongs in src/business/ instead.
 */
export interface Copy {
  productName: string;
  /** Tab bar labels, keyed by the shared tab ids. */
  tabs: { checkin: string; map: string; faf: string; feeds: string; safety: string; settings: string };

  checkIn: {
    eyebrow: string;
    title: string;
    subtitle: string;
    timerOn: string;
    timerOff: string;
    timerOnHint: string;
    timerOffHint: string;
    nextLabel: string;
    button: string;
    intervalTitle: string;
    intervalHint: string;
  };

  contacts: {
    title: string;
    hint: string;
    empty: string;
    addButton: string;
    relationLabel: string;
    relationPlaceholder: string;
  };

  safety: {
    eyebrow: string;
    title: string;
    subtitle: string;
    disclaimer: string;
  };

  feeds: {
    eyebrow: string;
    title: string;
    subtitle: string;
    noticeTitle: string;
    noticeBody: string;
    composeTitle: string;
    composeSubtitle: string;
    emptyTitle: string;
  };

  faf: {
    eyebrow: string;
    title: string;
    subtitle: string;
    idLabel: string;
    idHint: string;
    connectTitle: string;
  };

  escalationNote: string;
}

const individualCopy: Copy = {
  productName: 'Inertia',
  tabs: { checkin: 'Check in', map: 'Map', faf: 'FaF', feeds: 'Feeds', safety: 'Safety', settings: 'Settings' },

  checkIn: {
    eyebrow: 'Inertia safety',
    title: 'Check in',
    subtitle: 'One tap tells your circle you are okay.',
    timerOn: 'Timer running',
    timerOff: 'Timer paused',
    timerOnHint: 'Miss a check-in and your trusted contacts are alerted.',
    timerOffHint: 'Nobody will be alerted while this is off.',
    nextLabel: 'NEXT CHECK-IN',
    button: "I'm safe",
    intervalTitle: 'Set click time',
    intervalHint: 'How often you should tap “I’m safe”. Miss it and your trusted contacts are alerted.',
  },

  contacts: {
    title: 'Trusted contacts',
    hint: 'Up to five people who are alerted if you go quiet.',
    empty: 'No trusted contacts yet.',
    addButton: 'Add trusted contact',
    relationLabel: 'Relationship',
    relationPlaceholder: 'Friend, family, colleague',
  },

  safety: {
    eyebrow: 'AI safety monitor',
    title: 'Safety dashboard',
    subtitle: 'A quiet watch over your check-in behaviour.',
    disclaimer:
      'Missed check-ins are detected by Inertia’s servers, but trusted-contact escalation has not been tested on real devices yet. Do not rely on this as an emergency service.',
  },

  feeds: {
    eyebrow: 'Community safety',
    title: 'Feeds',
    subtitle: 'Anonymous updates from around you.',
    noticeTitle: 'Verified community feed',
    noticeBody:
      'Reports here are reviewed and must follow the community guidelines. Share only what you have seen yourself — posting fake news or misleading reports will result in a penalty.',
    composeTitle: 'New report',
    composeSubtitle: 'Posted anonymously — your name is never shown.',
    emptyTitle: 'Nothing reported here yet',
  },

  faf: {
    eyebrow: 'Safety circle',
    title: 'Find a Friend',
    subtitle: 'Connect by FaF ID to share live location. Both sides must agree, and either can stop it.',
    idLabel: 'YOUR FAF ID',
    idHint: 'Share this with people you trust so they can request to connect.',
    connectTitle: 'Connect to someone',
  },

  escalationNote: 'your trusted contacts',
};

const businessCopy: Copy = {
  productName: 'Inertia Business',
  tabs: { checkin: 'Shift', map: 'Map', faf: 'Team', feeds: 'Reports', safety: 'Safety', settings: 'Settings' },

  checkIn: {
    eyebrow: 'Lone worker safety',
    title: 'Shift check-in',
    subtitle: 'One tap confirms you are safe on shift.',
    timerOn: 'On shift',
    timerOff: 'Off shift',
    timerOnHint: 'Miss a check-in and your escalation contacts are alerted.',
    timerOffHint: 'Monitoring is off. Nobody will be alerted until you go back on shift.',
    nextLabel: 'NEXT CHECK-IN DUE',
    button: "I'm safe",
    intervalTitle: 'Check-in frequency',
    intervalHint:
      'How often a worker must confirm they are safe. Miss it and your escalation contacts are alerted.',
  },

  contacts: {
    title: 'Escalation contacts',
    hint: 'Up to five people alerted if a check-in is missed — a supervisor, a duty manager, next of kin.',
    empty: 'No escalation contacts yet. Add at least one before relying on this.',
    addButton: 'Add escalation contact',
    relationLabel: 'Role',
    relationPlaceholder: 'Supervisor, duty manager, next of kin',
  },

  safety: {
    eyebrow: 'Risk monitor',
    title: 'Safety dashboard',
    subtitle: 'Check-in compliance and risk across your shifts.',
    disclaimer:
      'Missed check-ins are detected by Inertia’s servers, but escalation has not been tested on real devices yet. This does not replace your own lone-worker procedures or an emergency service.',
  },

  feeds: {
    eyebrow: 'Trade safety',
    title: 'Site reports',
    subtitle: 'Anonymous hazard and incident reports from other businesses nearby.',
    noticeTitle: 'Verified business feed',
    noticeBody:
      'Reports here are reviewed and must follow the community guidelines. Share only what you have seen yourself — posting false or misleading reports will result in a penalty.',
    composeTitle: 'New site report',
    composeSubtitle: 'Posted anonymously — your business name is never shown.',
    emptyTitle: 'No site reports here yet',
  },

  faf: {
    eyebrow: 'Team locate',
    title: 'Find a Colleague',
    subtitle: 'Connect by FaF ID to share live location on shift. Both sides must agree, and either can stop it.',
    idLabel: 'YOUR FAF ID',
    idHint: 'Share this with colleagues so they can request to connect during a shift.',
    connectTitle: 'Connect to a colleague',
  },

  escalationNote: 'your escalation contacts',
};

export const copyFor = (brand: Brand): Copy => (brand === 'business' ? businessCopy : individualCopy);
