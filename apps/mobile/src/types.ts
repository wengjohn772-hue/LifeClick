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

export interface FeedPost {
  id: string;
  userId: string;
  area: string | null;
  body: string;
  tag: 'Alert' | 'Update' | 'Resolved' | 'Notice';
  likes: number;
  reposts: number;
  createdAt: string;
}

export interface SafetySettings {
  checkInIntervalMinutes: number;
  remindEnabled: boolean;
  remindBeforeMinutes: number;
  notificationsEnabled: boolean;
  trackingEnabled: boolean;
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
