const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  provider: string;
  phone?: string;
  address?: string;
  fafId?: string;
}

export interface TrustedContact {
  name: string;
  phone: string;
  relation: string;
}

export async function authenticate(payload: {
  mode: 'login' | 'register';
  email: string;
  password: string;
  name?: string;
  phone?: string;
  address?: string;
  trustedContacts?: TrustedContact[];
}) {
  const endpoint = payload.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const body = payload.mode === 'register'
    ? payload
    : { email: payload.email, password: payload.password, method: 'email' };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `API request failed (${response.status})`);
  return data as { ok: true; user: AuthUser; trustedContacts?: TrustedContact[]; saved?: boolean; message?: string };
}

export async function saveLocation(payload: { userId: string | number; latitude: number; longitude: number; accuracy: number; status: string }) {
  const response = await fetch(`${API_BASE_URL}/api/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Location request failed (${response.status})`);
  return data as { ok: boolean; saved: boolean };
}
