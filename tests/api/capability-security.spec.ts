import { request } from '@playwright/test';
import { test, expect } from '../../fixtures/qa';
import { Api, privacy, requireStatus } from '../../helpers/api';
import { environment } from '../../helpers/environment';
import { pdf } from '../../helpers/shared.cjs';

test('signed storage capability rejects missing token, modified signature and another owned object path', async ({ assessment: s, apis, evidence }) => {
  const firstBytes = pdf('Capability A'), secondBytes = pdf('Capability B');
  const a = await s.upload('capability-a.pdf', s.root.id, firstBytes);
  const b = await s.upload('capability-b.pdf', s.root.id, secondBytes);
  const issue = async (id: string) => requireStatus(await apis.owner.send<{ url: string }>('GET', `/files/${id}/download-url`), 200).url;
  const aUrl = await issue(a.id), bUrl = await issue(b.id);
  const valid = await apis.anonymous.download(aUrl, true);
  expect(valid.status).toBe(200); expect(valid.bytes.equals(firstBytes)).toBe(true);
  const absent = new URL(aUrl); absent.searchParams.delete('token');
  const tampered = new URL(aUrl), token = tampered.searchParams.get('token');
  if (!token || token.split('.').length !== 3) throw new Error('AutomationError: expected signed storage JWT format unavailable');
  const parts = token.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  tampered.searchParams.set('token', parts.join('.'));
  const swapped = new URL(aUrl); swapped.pathname = new URL(bUrl).pathname;
  for (const [variant, url] of [['missing token', absent], ['modified signature', tampered], ['other owned object path', swapped]] as const) {
    privacy.protect(url.toString());
    const result = await apis.anonymous.download(url.toString(), true);
    evidence.record({ check: 'Storage capability negative control; only assessment-owned objects', variant, status: result.status, returnsEitherOriginal: result.bytes.equals(firstBytes) || result.bytes.equals(secondBytes) });
    if (result.status >= 500 || [408, 425, 429].includes(result.status)) throw new Error('EnvironmentError: storage negative control inconclusive');
    expect(result.status).toBeGreaterThanOrEqual(400); expect(result.status).toBeLessThan(500);
    expect(result.bytes.equals(firstBytes) || result.bytes.equals(secondBytes)).toBe(false);
  }
  const control = await apis.anonymous.download(await issue(b.id), true);
  expect(control.status).toBe(200); expect(control.bytes.equals(secondBytes)).toBe(true);
});

test('API rejects JWT payload tampering, signature tampering and unsigned alg:none tokens', async ({ assessment: s, apis, actors, evidence }) => {
  const me = requireStatus(await apis.owner.send<{ id: string }>('GET', '/auth/me'), 200);
  const original = actors.viewerToken.split('.');
  const claims = JSON.parse(Buffer.from(original[1], 'base64url').toString('utf8'));
  const changedPayload = [...original];
  changedPayload[1] = Buffer.from(JSON.stringify({ ...claims, sub: me.id })).toString('base64url');
  const changedSignature = [...original];
  changedSignature[2] = (original[2][0] === 'A' ? 'B' : 'A') + original[2].slice(1);
  const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${changedPayload[1]}.`;
  for (const [variant, token] of [['payload', changedPayload.join('.')], ['signature', changedSignature.join('.')], ['unsigned', unsigned]]) {
    privacy.protect(token);
    const context = await request.newContext({ baseURL: environment.apiURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    try {
      const api = new Api(context, evidence);
      for (const endpoint of ['/auth/me', `/folders/${s.root.id}/contents`]) expect((await api.send('GET', endpoint)).status).toBe(401);
      evidence.record({ check: 'JWT integrity', variant, expectedStatus: 401 });
    } finally { await context.dispose(); }
  }
});
