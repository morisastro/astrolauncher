let cachedUrl: string | null = null;
let cachedKey: string | null = null;

const FALLBACK_URL = 'http://api.morisastro.pl:3001';

async function getBaseUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  try {
    if (window.astro) {
      cachedUrl = await window.astro.getApiUrl();
    }
  } catch {}
  if (!cachedUrl) cachedUrl = FALLBACK_URL;
  return cachedUrl;
}

async function getKey(): Promise<string | null> {
  if (cachedKey !== null) return cachedKey;
  try {
    if (window.astro) {
      cachedKey = await window.astro.getLauncherKey();
    }
  } catch {}
  return cachedKey;
}

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const h: Record<string, string> = { ...extra };
  const key = await getKey();
  if (key) h['x-astro-key'] = key;
  return h;
}

export async function apiGet(path: string, token?: string) {
  const h = await headers();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api${path}`, { headers: h });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path: string, body: unknown, token?: string) {
  const h = await headers({ 'Content-Type': 'application/json' });
  if (token) h['Authorization'] = `Bearer ${token}`;
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api${path}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string, token?: string) {
  const h = await headers();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api${path}`, { method: 'DELETE', headers: h });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}
