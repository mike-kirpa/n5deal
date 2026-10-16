import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

if (existsSync(resolve('.env'))) process.loadEnvFile(resolve('.env'));
// Verified in pinned Playwright 1.56.1: suppress its unredacted automatic DOM/error-context dump.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
if (process.env.DEBUG?.includes('pw:') || process.env.PWDEBUG) throw new Error('EnvironmentError: raw Playwright debug logging is disabled for credential safety');
process.env.QA_RUN_ID ||= `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
if (!/^[A-Za-z0-9_-]{1,100}$/.test(process.env.QA_RUN_ID)) throw new Error('Invalid QA_RUN_ID');
export const runDirectory = join('artifacts', 'automation', process.env.QA_RUN_ID);
export const environment = {
  webURL: (process.env.BASE_URL || 'https://virtual-data-room-ten.vercel.app').replace(/\/$/, ''),
  apiURL: (process.env.API_BASE_URL || 'https://virtual-data-room-production.up.railway.app').replace(/\/$/, ''),
  channel: process.env.QA_BROWSER_CHANNEL || undefined,
  owner: { email: process.env.QA_OWNER_EMAIL || 'john@example.com', password: process.env.QA_OWNER_PASSWORD || '' },
  viewer: { email: process.env.QA_VIEWER_EMAIL || 'viewer@example.com', password: process.env.QA_VIEWER_PASSWORD || '' },
};

export function validateEnvironment() {
  if (environment.owner.email !== 'john@example.com' || environment.viewer.email !== 'viewer@example.com') {
    throw new Error('EnvironmentError: only the two documented assessment accounts are allowed');
  }
  if (!environment.owner.password || !environment.viewer.password) {
    throw new Error('EnvironmentError: set QA_OWNER_PASSWORD and QA_VIEWER_PASSWORD, or use npm run test:documented');
  }
  for (const url of [environment.webURL, environment.apiURL]) {
    if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('EnvironmentError: invalid target URL');
  }
}
