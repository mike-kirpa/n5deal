import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
import { test, expect } from '../../fixtures/qa';
import { Api, privacy, requireStatus } from '../../helpers/api';
import type { PageOf, Share } from '../../helpers/api';
import { environment } from '../../helpers/environment';
import { fileReads } from '../../helpers/revocation';
import { pdf } from '../../helpers/shared.cjs';

test('USER folder revocation denies all fresh file reads while an old signed URL is observed separately', async ({ assessment: s, apis, actors, evidence }) => {
  const folder = await s.folder('Revocable documents');
  const bytes = pdf('USER revocation');
  const file = await s.upload('revocation.pdf', folder.id, bytes);
  const grant = await s.share('FOLDER', folder.id);
  await fileReads(apis.viewer, file.id, 200);
  const issued = requireStatus(await apis.viewer.send<{ url: string }>('GET', `/files/${file.id}/view-url`), 200);
  const before = await apis.anonymous.download(issued.url, true);
  expect(before.status).toBe(200); expect(before.bytes.equals(bytes)).toBe(true);
  expect((await apis.viewer.send('PATCH', `/files/${file.id}`, { name: 'not-allowed.pdf' })).status).toBe(404);
  await s.revoke(grant.id);
  const context = await request.newContext({ baseURL: environment.apiURL, extraHTTPHeaders: { Authorization: `Bearer ${actors.viewerToken}` } });
  try { await fileReads(new Api(context, evidence), file.id, 404); }
  finally { await context.dispose(); }
  await fileReads(apis.owner, file.id, 200);
  expect((await apis.viewer.send('PATCH', `/files/${file.id}`, { name: 'still-not-allowed.pdf' })).status).toBe(404);
  const active = requireStatus(await apis.owner.send<PageOf<Share>>('GET', `/shares?resourceType=FOLDER&resourceId=${folder.id}`), 200);
  expect(active.items.some(g => g.id === grant.id)).toBe(false);
  const old = await apis.anonymous.download(issued.url, true);
  evidence.record({ observation: 'Old signed view URL after USER revocation; not a fresh authorization bypass', status: old.status, returnsOriginalBytes: old.bytes.equals(bytes) });
  // Storage may retain the capability or invalidate it early. Neither is a fresh API grant.
  if (old.status === 200) expect(old.bytes.equals(bytes)).toBe(true);
  else expect(old.status).toBeGreaterThanOrEqual(400);
});

test('file PUBLIC_LINK revocation rejects all token routes without revoking an independent USER grant', async ({ assessment: s, apis }) => {
  const file = await s.upload('public-revocation.pdf');
  const user = await s.share('FILE', file.id);
  const grant = await s.share('FILE', file.id, 'PUBLIC_LINK');
  const prefix = `/public/${grant.token}`;
  const routes = ['', `/files/${file.id}`, `/files/${file.id}/view-url`, `/files/${file.id}/download-url`];
  for (const route of routes) expect((await apis.anonymous.send('GET', `${prefix}${route}`)).status).toBe(200);
  const unknown = privacy.protect(`qa-unknown-${randomUUID()}`);
  for (const route of routes) expect((await apis.anonymous.send('GET', `/public/${unknown}${route}`)).status).toBe(404);
  await s.revoke(grant.id);
  for (const route of routes) expect((await apis.anonymous.send('GET', `${prefix}${route}`)).status).toBe(410);
  const renewed = await s.share('FILE', file.id, 'PUBLIC_LINK');
  expect(renewed.token === grant.token).toBe(false);
  expect((await apis.anonymous.send('GET', prefix)).status).toBe(410);
  expect((await apis.anonymous.send('GET', `/public/${renewed.token}`)).status).toBe(200);
  await fileReads(apis.viewer, file.id, 200);
  await fileReads(apis.owner, file.id, 200);
  await s.revoke(renewed.id); await s.revoke(user.id);
  await fileReads(apis.viewer, file.id, 404);
});

test('revoking a folder grant preserves direct file reads until the independent file grant is revoked', async ({ assessment: s, apis }) => {
  const folder = await s.folder('Shared parent'), sibling = await s.folder('Unshared sibling');
  const file = await s.upload('independent-grants.pdf', folder.id);
  const inherited = await s.share('FOLDER', folder.id), direct = await s.share('FILE', file.id);
  await fileReads(apis.viewer, file.id, 200);
  await s.revoke(inherited.id);
  await fileReads(apis.viewer, file.id, 200);
  for (const id of [folder.id, sibling.id, s.root.id]) expect((await apis.viewer.send('GET', `/folders/${id}/contents`)).status).toBe(404);
  await s.revoke(direct.id);
  await fileReads(apis.viewer, file.id, 404);
  await fileReads(apis.owner, file.id, 200);
});
