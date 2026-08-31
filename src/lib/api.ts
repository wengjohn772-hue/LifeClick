const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  provider: string;
}

export interface LocationPayload {
  userId: string | number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  status?: string;
}

export async function login(email: string, password: string, method: 'google' | 'email') {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, method }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Unable to sign in');
  return data as { ok: true; user: AuthUser };
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