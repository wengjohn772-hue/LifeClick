export type Tab = 'checkin' | 'map' | 'faf' | 'feeds' | 'safety' | 'settings';

export type AccountType = 'individual' | 'business';

export interface AuthUser {
  id: string | number;
  /** Fixed at signup; decides which product the account belongs to. */
  accountType?: AccountType;
  businessName?: string;
  businessType?: string;
  name: string;
  email: string;
  provider?: string;
  phone?: string;
  address?: string;
  fafId?: string;
  avatarId?: string;
  role?: string;
  postsEnabled?: boolean;
  feedsEnabled?: boolean;
}

export interface TrustedContact {
  id?: number;
  name: string;
  phone: string;
  relation: string;
}

export type FeedTag = 'Alert' | 'Update' | 'Resolved' | 'Notice';

export const FEED_TAGS: FeedTag[] = ['Alert', 'Update', 'Resolved', 'Notice'];

export interface FeedPost {
  id: string;
  userId: string;
  area: string | null;
  country: string | null;
  state: string | null;
  body: string;
  tag: FeedTag;
  likes: number;
  reposts: number;
  likedByMe: boolean;
  repostedByMe: boolean;
  /** Absolute URL, or an API path that needs the base URL prepended. */
  imageUrl: string | null;
  mine: boolean;
  createdAt: string;
}

export interface FeedRegion {
  country: string;
  posts: number;
  states: Array<{ state: string; posts: number }>;
}

export interface ReactionResult {
  likes: number;
  reposts: number;
  likedByMe: boolean;
  repostedByMe: boolean;
}

export interface SafetySettings {
  checkInIntervalMinutes: number;
  remindEnabled: boolean;
  remindBeforeMinutes: number;
  notificationsEnabled: boolean;
  /** Background location tracking. */
  trackingEnabled: boolean;
  /** The check-in timer itself, toggled from the Check in tab. */
  monitoringEnabled: boolean;
}

export interface CheckInRecord {
  id: number | string;
  status: 'safe' | 'missed';
  checkedInAt: string | null;
  scheduledFor: string | null;
  intervalMinutes: number | null;
}

export interface ConsentChoices {
  locationTracking: boolean;
  backgroundMonitoring: boolean;
  ipLogging: boolean;
  contactEscalation: boolean;
}

export interface ConsentStatus {
  termsVersion: string;
  current: boolean;
  consent: (ConsentChoices & { termsVersion: string; acceptedAt: string }) | null;
}

export interface SecurityEvent {
  type: string;
  ip: string | null;
  device: string | null;
  outcome: string;
  at: string;
}

export interface AccessSummary {
  ip: string | null;
  requests: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SecurityActivity {
  events: SecurityEvent[];
  requestSummary: AccessSummary[];
  retention: { accessLogDays: number; securityLogDays: number; locationDays: number };
}

export interface FafPerson {
  name: string;
  fafId: string;
  avatarId: string;
}

export interface FafFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

export interface FafRequest {
  id: string;
  status: string;
  requestedAt: string;
  direction: 'incoming' | 'outgoing';
  person: FafPerson;
}

export interface FafConnection {
  id: string;
  status: string;
  startedAt: string | null;
  person: FafPerson;
  /** Null until the other person's device has reported a position. */
  location: FafFix | null;
  startedByMe: boolean;
}

export interface Incident {
  id: number;
  status: string;
  stage: string;
  missedDeadlineAt: string;
  openedAt: string;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface AuthResult {
  ok: true;
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  trustedContacts?: TrustedContact[];
  demo?: boolean;
  message?: string;
}

/* ------------------------------------------------- sensors & patterns */

export type ImpactKind = 'impact' | 'crash' | 'fall';

export interface PendingImpact {
  id: string;
  kind: ImpactKind;
  peakG?: number | null;
  confirmDeadline: string;
  secondsRemaining: number;
}

export interface ImpactRecord {
  id: string;
  kind: ImpactKind;
  peakG: number | null;
  followedByStillness: boolean;
  status: 'pending' | 'cancelled' | 'escalated' | 'expired';
  detectedAt: string;
  resolvedAt: string | null;
}

export interface LearnedPlace {
  id: string;
  label: string | null;
  latitude: number;
  longitude: number;
  visits: number;
  firstSeen: string;
  lastSeen: string;
}

export interface LearnedRoute {
  id: string;
  count: number;
  from: { id: string; label: string | null; latitude: number; longitude: number };
  to: { id: string; label: string | null; latitude: number; longitude: number };
  firstSeen: string;
  lastSeen: string;
}

export interface PatternAlert {
  id: string;
  kind: 'new_place' | 'new_route';
  detail: string | null;
  at: string;
  acknowledged: boolean;
}

export interface PatternSummary {
  learning: boolean;
  placesKnown: number;
  places: LearnedPlace[];
  routes: LearnedRoute[];
  alerts: PatternAlert[];
}

export interface StepSummaryResult {
  today: number;
  average: number;
  days: Array<{ day: string; steps: number; source: string }>;
}
