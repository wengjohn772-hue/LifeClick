const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  provider: string;
  phone?: string;
  address?: string;
  fafId?: string;
}

export interface LocationPayload {
  userId: string | number;
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

export async function login(email: string, password: string, method: 'google' | 'email') {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, method }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Unable to sign in');
  return data as { ok: true; user: AuthUser; trustedContacts?: RegistrationPayload['trustedContacts'] };
}

export async function register(payload: RegistrationPayload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Unable to create account');
  return data as { ok: true; user: AuthUser; trustedContacts: RegistrationPayload['trustedContacts'] };
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

export async function saveLocation(payload: LocationPayload) {
  const response = await fetch(`${API_BASE_URL}/api/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Unable to save location');
  return data as { ok: true; saved: boolean };
}