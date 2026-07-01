const API_URL = process.env.API_URL || 'http://localhost:3001';
const LAUNCHER_KEY = process.env.LAUNCHER_KEY || '';

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (LAUNCHER_KEY) h['x-astro-key'] = LAUNCHER_KEY;
  return h;
}

export async function apiGet(path: string) {
  const h = await headers();
  const res = await fetch(`${API_URL}/api${path}`, { headers: h });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path: string, body: unknown) {
  const h = await headers();
  h['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPatch(path: string, body: unknown) {
  const h = await headers();
  h['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
