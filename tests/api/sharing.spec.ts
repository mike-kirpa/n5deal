import { test, expect } from '../../fixtures/qa';
import { requireStatus } from '../../helpers/api';
import type { Document } from '../../helpers/api';

test('folder grants inherit downwards without exposing ancestors or permitting writes', async ({ assessment: s, apis }) => {
  const shared = await s.folder('Shared'), child = await s.folder('Descendant', shared.id), sibling = await s.folder('Private sibling');
  expect((await apis.viewer.send('GET', `/folders/${shared.id}/contents`)).status).toBe(404);
  const grant = await s.share('FOLDER', shared.id);
  expect((await apis.viewer.send('GET', `/folders/${child.id}/contents`)).status).toBe(200);
  const crumbs = requireStatus(await apis.viewer.send<{ dataRoomName: string | null; folders: { id: string }[]; accessLevel: string }>('GET', `/folders/${child.id}/breadcrumbs`), 200);
  expect(crumbs.dataRoomName).toBeNull(); expect(crumbs.accessLevel).toBe('VIEWER');
  expect(crumbs.folders.map((i) => i.id)).toEqual([shared.id, child.id]);
  for (const id of [s.root.id, sibling.id]) expect((await apis.viewer.send('GET', `/folders/${id}/contents`)).status).toBe(404);
  const operations: [string, string, unknown?][] = [
    ['POST', '/folders', { dataRoomId: s.roomId, parentId: shared.id, name: 'forbidden' }],
    ['PATCH', `/folders/${shared.id}`, { name: 'forbidden' }], ['DELETE', `/folders/${child.id}`],
    ['GET', `/folders/${shared.id}/delete-preview`],
    ['POST', '/shares', { resourceType: 'FOLDER', resourceId: shared.id, mode: 'PUBLIC_LINK' }],
    ['GET', `/shares?resourceType=FOLDER&resourceId=${shared.id}`], ['DELETE', `/shares/${grant.id}`],
  ];
  for (const [method, path, body] of operations) expect((await apis.viewer.send(method, path, body)).status).toBe(404);
  expect((await s.share('FOLDER', shared.id)).id).toBe(grant.id);
  await s.revoke(grant.id);
  expect((await apis.viewer.send('GET', `/folders/${child.id}/contents`)).status).toBe(404);
});

test('file mutation denial, overlapping grants and moves use current inheritance', async ({ assessment: s, apis }) => {
  const shared = await s.folder('Shared'), privateFolder = await s.folder('Private');
  const file = await s.upload('shared.pdf', shared.id);
  expect((await apis.viewer.send('GET', `/files/${file.id}`)).status).toBe(404);
  const inherited = await s.share('FOLDER', shared.id), direct = await s.share('FILE', file.id);
  expect((await apis.viewer.send('GET', `/files/${file.id}`)).status).toBe(200);
  const operations: [string, string, unknown?][] = [
    ['PATCH', `/files/${file.id}`, { name: 'forbidden.pdf' }], ['DELETE', `/files/${file.id}`],
    ['PATCH', `/files/${file.id}/move`, { targetFolderId: privateFolder.id }], ['POST', `/files/${file.id}/complete`],
    ['POST', '/files/upload-intent', { dataRoomId: s.roomId, folderId: shared.id, name: 'no.pdf', size: 1, mimeType: 'application/pdf' }],
  ];
  for (const [method, path, body] of operations) expect((await apis.viewer.send(method, path, body)).status).toBe(404);
  await s.revoke(direct.id);
  requireStatus(await apis.owner.send<Document>('PATCH', `/files/${file.id}/move`, { targetFolderId: privateFolder.id }), 200);
  expect((await apis.viewer.send('GET', `/files/${file.id}`)).status).toBe(404);
  const renewedDirect = await s.share('FILE', file.id);
  await s.revoke(inherited.id);
  expect((await apis.viewer.send('GET', `/files/${file.id}`)).status).toBe(200);
  await s.revoke(renewedDirect.id);
  for (const suffix of ['', '/view-url', '/download-url']) expect((await apis.viewer.send('GET', `/files/${file.id}${suffix}`)).status).toBe(404);
});

test('public tokens are read-only subtree capabilities and fresh access stops on revoke', async ({ assessment: s, apis }) => {
  const shared = await s.folder('Public subtree'), sibling = await s.folder('Private sibling');
  const file = await s.upload('public.pdf', shared.id);
  const grant = await s.share('FOLDER', shared.id, 'PUBLIC_LINK');
  expect((await s.share('FOLDER', shared.id, 'PUBLIC_LINK')).id).toBe(grant.id);
  const prefix = `/public/${grant.token}`;
  expect((await apis.anonymous.send('GET', prefix)).status).toBe(200);
  expect((await apis.anonymous.send('GET', `${prefix}/folders/${shared.id}/contents`)).status).toBe(200);
  expect((await apis.anonymous.send('GET', `${prefix}/files/${file.id}`)).status).toBe(200);
  expect((await apis.anonymous.send('GET', `${prefix}/contents`)).status).toBe(404);
  expect((await apis.anonymous.send('GET', `${prefix}/folders/${sibling.id}/contents`)).status).toBe(404);
  await s.revoke(grant.id);
  for (const suffix of ['', `/files/${file.id}`, `/files/${file.id}/view-url`, `/files/${file.id}/download-url`]) {
    expect((await apis.anonymous.send('GET', `${prefix}${suffix}`)).status).toBe(410);
  }
});
