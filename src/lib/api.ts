const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000')).replace(/\/$/, '');

const TOKEN_STORAGE_KEY = 'lifeclick.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
}

// Kept in memory and mirrored to localStorage so a reload does not sign the
// prototype user out. localStorage is adequate for the investor prototype; a
// production web client should move to an httpOnly cookie.
let tokens: StoredTokens | null = null;

function readStoredTokens(): StoredTokens | null {
  if (tokens) return tokens;
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    tokens = raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

export function setTokens(next: StoredTokens | null) {
  tokens = next;
  try {
    if (next) window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Private browsing or disabled storage; the in-memory copy still works.
  }
}

export function hasSession() {
  return Boolean(readStoredTokens()?.accessToken);
}

async function readResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  await response.text();
  throw new Error(
    response.status === 404
      ? 'API route not found. Redeploy the project with the Vercel API function enabled.'
      : `API request failed (${response.status}).`
  );
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

let refreshInFlight: Promise<StoredTokens | null> | null = null;

async function refreshTokens(): Promise<StoredTokens | null> {
  const current = readStoredTokens();
  if (!current?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await rawFetch('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.accessToken) {
          setTokens(null);
          return null;
        }
        const next = { accessToken: data.accessToken, refreshToken: data.refreshToken };
        setTokens(next);
        return next;
      } catch {
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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const init: RequestInit = { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };

  const current = auth ? readStoredTokens() : null;
  let response = await rawFetch(path, init, current?.accessToken);

  if (auth && response.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) response = await rawFetch(path, init, refreshed.accessToken);
  }

  const data = await readResponse(response);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data as T;
}

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  provider: string;
  phone?: string;
  address?: string;
  fafId?: string;
  avatarId?: string;
  role?: string;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  status?: string;
}

export interface RegistrationPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  trustedContacts: Array<{ name: string; phone: string; relation: string }>;
}

interface AuthResponse {
  ok: true;
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  trustedContacts?: RegistrationPayload['trustedContacts'];
  demo?: boolean;
  message?: string;
}

export async function login(email: string, password: string, method: 'google' | 'email') {
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password, method },
    auth: false,
  });
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export async function register(payload: RegistrationPayload) {
  const data = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export async function logout() {
  const current = readStoredTokens();
  if (current?.refreshToken) {
    await request('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
      auth: false,
    }).catch(() => undefined);
  }
  setTokens(null);
}

export function getGoogleAuthUrl() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * The user is derived from the access token server-side, so no user ID is sent.
 */
export function saveLocation(payload: LocationPayload) {
  return request<{ ok: true; saved: boolean }>('/api/location', { method: 'POST', body: payload });
}

export const getContacts = () =>
  request<{ contacts: Array<{ id: number; name: string; phone: string; relation: string }> }>('/api/contacts');

export const getFeeds = () =>
  request<{ posts: Array<{ id: string; userId: string; area: string | null; body: string; tag: string; likes: number; reposts: number; createdAt: string }> }>(
    '/api/feeds'
  );
