import { expect } from '@playwright/test';
import type { Api } from './api';

/** Every call makes fresh HTTP requests; no browser/query cache is used. */
export async function fileReads(api: Api, id: string, status: number) {
  for (const suffix of ['', '/view-url', '/download-url']) {
    expect((await api.send('GET', `/files/${id}${suffix}`)).status, `file read ${suffix || 'metadata'}`).toBe(status);
  }
}

/** Decode only the expiry in memory. Never log the URL, token or claims. */
export function signedExpiryMilliseconds(url: string) {
  try {
    const token = new URL(url).searchParams.get('token');
    const claims = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString('utf8')) as { exp?: number };
    const expiry = Number(claims.exp) * 1000;
    if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + 360_000) throw new Error();
    return expiry;
  } catch { throw new Error('AutomationError: usable short signed-URL expiry unavailable; no token data recorded'); }
}
