export type Tab = 'checkin' | 'map' | 'faf' | 'feeds' | 'safety' | 'settings';

export interface AuthUser {
  id: string | number;
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
