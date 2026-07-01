let cachedUrl: string | null = null;
let cachedKey: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  if (window.astro) {
    cachedUrl = await window.astro.getApiUrl();
  } else {
    cachedUrl = 'http://localhost:3001';
  }
  return cachedUrl;
}

async function getKey(): Promise<string | null> {
  if (cachedKey !== null) return cachedKey;
  if (window.astro) {
    cachedKey = await window.astro.getLauncherKey();
  } else {
    cachedKey = null;
  }
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
