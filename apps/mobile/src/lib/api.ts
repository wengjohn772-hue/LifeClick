import { StorageKeys, getJson, removeItem, setJson } from './storage';
import type {
  AuthResult,
  AuthUser,
  CheckInRecord,
  ConsentChoices,
  ConsentStatus,
  FafConnection,
  FafFix,
  FafRequest,
  FeedPost,
  FeedRegion,
  FeedTag,
  Incident,
  ReactionResult,
  SafetySettings,
  SecurityActivity,
  TrustedContact,
} from '../types';

const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';
export const API_BASE_URL = RAW_BASE.replace(/\/$/, '');

/**
 * True when the app is pointed at a loopback address. On a physical device that
 * resolves to the phone itself, so every request fails — the default was the
 * reason device builds could never authenticate.
 */
export const isLoopbackApi = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(API_BASE_URL);

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
}

// Cached in memory so the background location task does not hit SecureStore on
// every position update, but always re-hydrated from storage on a cold start.
let tokens: StoredTokens | null = null;
let hydrated = false;
let refreshInFlight: Promise<StoredTokens | null> | null = null;
let onAuthLost: (() => void) | undefined;

export function setAuthLostHandler(handler: (() => void) | undefined) {
  onAuthLost = handler;
}

export async function loadTokens(): Promise<StoredTokens | null> {
  if (!hydrated) {
    tokens = await getJson<StoredTokens>(StorageKeys.tokens);
    hydrated = true;
  }
  return tokens;
}

export async function saveTokens(next: StoredTokens | null) {
  tokens = next;
  hydrated = true;
  if (next) await setJson(StorageKeys.tokens, next);
  else await removeItem(StorageKeys.tokens);
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    await response.text().catch(() => undefined);
    return null;
  }
  return response.json().catch(() => null);
}

async function rawFetch(path: string, init: RequestInit, accessToken?: string) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers || {}),
    },
  });
}

/** Exchanges the refresh token for a new pair. Deduplicated across callers. */
async function refreshTokens(): Promise<StoredTokens | null> {
  const current = await loadTokens();
  if (!current?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await rawFetch('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const data = await parse(response);
        if (!response.ok || !data?.accessToken) {
          await saveTokens(null);
          onAuthLost?.();
          return null;
        }
        const next: StoredTokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
        await saveTokens(next);
        return next;
      } catch {
        // Network failure: keep the tokens so a later retry can succeed.
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const init: RequestInit = { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };

  const current = auth ? await loadTokens() : null;
  let response = await rawFetch(path, init, current?.accessToken);

  // One transparent retry when the access token has simply aged out.
  if (auth && response.status === 401) {
    const data = await parse(response);

    if (data?.code === 'token_expired' || data?.code === 'token_invalid') {
      const refreshed = await refreshTokens();
      if (refreshed) {
        response = await rawFetch(path, init, refreshed.accessToken);
      } else {
        onAuthLost?.();
        throw new ApiError(data?.error || 'Your session expired. Sign in again.', 401, data?.code);
      }
    } else {
      // A structurally valid token whose account is gone: refreshing cannot
      // help, so drop the session rather than retrying forever.
      if (data?.code === 'account_missing') {
        await saveTokens(null);
        onAuthLost?.();
      }
      throw new ApiError(data?.error || 'Authentication required.', 401, data?.code);
    }
  }

  const data = await parse(response);
  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status}).`, response.status, data?.code);
  }
  return data as T;
}

/* ------------------------------------------------------------------ auth */

export async function authenticate(payload: {
  mode: 'login' | 'register';
  email: string;
  password: string;
  name?: string;
  phone?: string;
  address?: string;
  trustedContacts?: TrustedContact[];
}): Promise<AuthResult> {
  const isRegister = payload.mode === 'register';
  const body = isRegister
    ? {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        address: payload.address,
        trustedContacts: payload.trustedContacts ?? [],
      }
    : { email: payload.email, password: payload.password, method: 'email' as const };

  const result = await apiRequest<AuthResult>(isRegister ? '/api/auth/register' : '/api/auth/login', {
    method: 'POST',
    body,
    auth: false,
  });

  await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return result;
}

export async function logout(userId?: string | number) {
  const current = await loadTokens();
  if (current?.refreshToken) {
    // userId lets the server pause monitoring, so a signed-out phone does not
    // get escalated to its trusted contacts for going quiet.
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: current.refreshToken, userId },
      auth: false,
    }).catch(() => undefined);
  }
  await saveTokens(null);
}

export const deleteAccount = () => apiRequest<{ ok: true }>('/api/auth/account', { method: 'DELETE' });

/* --------------------------------------------------------------- profile */

export const getProfile = () => apiRequest<{ user: AuthUser }>('/api/profile');
export const updateProfile = (changes: Partial<AuthUser>) =>
  apiRequest<{ user: AuthUser }>('/api/profile', { method: 'PATCH', body: changes });

/* -------------------------------------------------------------- contacts */

export const getContacts = () => apiRequest<{ contacts: TrustedContact[] }>('/api/contacts');
export const addContact = (contact: TrustedContact) =>
  apiRequest<{ contact: TrustedContact }>('/api/contacts', { method: 'POST', body: contact });
export const deleteContact = (id: number) =>
  apiRequest<{ deleted: boolean }>(`/api/contacts/${id}`, { method: 'DELETE' });

/* ----------------------------------------------------------------- feeds */

/** Image URLs come back as API paths; the base URL is added for display. */
export const resolveImageUrl = (url: string | null) =>
  !url ? null : url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

export const getFeeds = (filter?: { country?: string; state?: string }) => {
  const params = new URLSearchParams();
  if (filter?.country && filter.country !== 'all') params.set('country', filter.country);
  if (filter?.state && filter.state !== 'all') params.set('state', filter.state);
  const suffix = params.toString();
  return apiRequest<{ posts: FeedPost[] }>(`/api/feeds${suffix ? `?${suffix}` : ''}`);
};

export const getFeedRegions = () => apiRequest<{ regions: FeedRegion[] }>('/api/feeds/regions');

export const getMyPosts = () => apiRequest<{ posts: FeedPost[] }>('/api/feeds/mine');

export const createPost = (payload: {
  body: string;
  tag: FeedTag;
  area?: string;
  country?: string;
  state?: string;
  image?: { base64: string; mimeType?: string; width?: number; height?: number };
}) => apiRequest<{ post: FeedPost }>('/api/feeds', { method: 'POST', body: payload });

export const deletePost = (id: string) =>
  apiRequest<{ deleted: boolean }>(`/api/feeds/${id}`, { method: 'DELETE' });

export const reactToPost = (id: string, kind: 'like' | 'repost') =>
  apiRequest<ReactionResult>(`/api/feeds/${id}/reactions`, { method: 'POST', body: { kind } });

/* -------------------------------------------------------------- check-in */

export const postCheckIn = (payload: { status: 'safe' | 'missed'; intervalMinutes?: number; scheduledFor?: string }) =>
  apiRequest<{ checkIn: CheckInRecord }>('/api/checkins', { method: 'POST', body: payload });

export const getCheckIns = () =>
  apiRequest<{ checkIns: CheckInRecord[]; missedCount: number }>('/api/checkins');

/* -------------------------------------------------------------- settings */

export const getSettings = () => apiRequest<{ settings: SafetySettings }>('/api/settings');
export const updateSettings = (changes: Partial<SafetySettings>) =>
  apiRequest<{ settings: SafetySettings }>('/api/settings', { method: 'PUT', body: changes });

/* -------------------------------------------------------------- location */

export const saveLocation = (payload: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  status?: 'live' | 'background' | 'manual';
}) => apiRequest<{ ok: boolean; saved: boolean }>('/api/location', { method: 'POST', body: payload });

export const getLatestLocation = () =>
  apiRequest<{ location: { latitude: number; longitude: number; accuracy: number; capturedAt: string } | null }>(
    '/api/location/latest'
  );

/* ------------------------------------------------------------ push token */

export const registerPushToken = (payload: { token: string; platform?: string; deviceName?: string }) =>
  apiRequest<{ ok: boolean }>('/api/push-tokens', { method: 'POST', body: payload });

export const unregisterPushToken = (token: string) =>
  apiRequest<{ ok: boolean }>('/api/push-tokens', { method: 'DELETE', body: { token } });

/* ------------------------------------------------ consent & security log */

export const getConsent = () => apiRequest<ConsentStatus & { ok: true }>('/api/security/consent');

export const saveConsent = (choices: ConsentChoices & { termsVersion?: string }) =>
  apiRequest<{ ok: true }>('/api/security/consent', { method: 'POST', body: choices });

export const withdrawConsent = () =>
  apiRequest<{ ok: true; monitoringStopped: boolean; locationEventsDeleted: number }>(
    '/api/security/consent/withdraw',
    { method: 'POST' }
  );

export const getSecurityActivity = () =>
  apiRequest<SecurityActivity & { ok: true }>('/api/security/activity');

export const getIncidents = () => apiRequest<{ incidents: Incident[] }>('/api/security/incidents');

/* ------------------------------------------------------- find a friend */

export const requestFafPairing = (fafId: string) =>
  apiRequest<{ request: FafRequest; notified: boolean }>('/api/faf/requests', {
    method: 'POST',
    body: { fafId },
  });

export const getFafRequests = () =>
  apiRequest<{ incoming: FafRequest[]; outgoing: FafRequest[] }>('/api/faf/requests');

export const respondToFafRequest = (id: string, accept: boolean) =>
  apiRequest<{ status: string; connectionId: string }>(`/api/faf/requests/${id}/respond`, {
    method: 'POST',
    body: { accept },
  });

export const cancelFafRequest = (id: string) =>
  apiRequest<{ cancelled: boolean }>(`/api/faf/requests/${id}`, { method: 'DELETE' });

export const getFafConnections = () =>
  apiRequest<{ connections: FafConnection[]; me: FafFix | null }>('/api/faf/connections');

export const disconnectFaf = (id: string) =>
  apiRequest<{ disconnected: boolean }>(`/api/faf/connections/${id}/disconnect`, { method: 'POST' });
