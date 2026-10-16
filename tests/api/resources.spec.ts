import { test, expect } from '../../fixtures/qa';
import { requireStatus } from '../../helpers/api';
import type { Document, Item, PageOf } from '../../helpers/api';
import { pdf } from '../../helpers/shared.cjs';

test('nested folders retain hierarchy, validate names and delete recursively', async ({ assessment: s, apis }) => {
  const parent = await s.folder('Parent');
  const child = await s.folder('Child', parent.id);
  const rename = await apis.owner.send<{ name: string }>('PATCH', `/folders/${child.id}`, { name: '  Renamed  ' });
  expect(rename.status).toBe(200); expect(rename.body.name).toBe('Renamed');
  expect((await apis.owner.send('POST', '/folders', { dataRoomId: s.roomId, parentId: parent.id, name: 'RENAMED' })).status).toBe(409);
  expect((await apis.owner.send('PATCH', `/folders/${child.id}`, { name: '   ' })).status).toBe(400);
  const crumbs = requireStatus(await apis.owner.send<{ folders: { id: string }[] }>('GET', `/folders/${child.id}/breadcrumbs`), 200);
  expect(crumbs.folders.map((f) => f.id)).toEqual([s.root.id, parent.id, child.id]);
  const preview = requireStatus(await apis.owner.send<{ folderCount: number }>('GET', `/folders/${parent.id}/delete-preview`), 200);
  expect(preview.folderCount).toBe(1);
  expect((await apis.owner.send('DELETE', `/folders/${parent.id}`)).status).toBe(204);
  expect((await apis.owner.send('GET', `/folders/${child.id}/contents`)).status).toBe(404);
  expect((await apis.owner.send('GET', `/folders/${s.root.id}/contents`)).status).toBe(200);
});

test('pending files stay invisible and invalid declared uploads are rejected', async ({ assessment: s, apis }) => {
  const pending = await s.intent('pending.pdf');
  const contents = requireStatus(await apis.owner.send<PageOf<Item>>('GET', `/folders/${s.root.id}/contents`), 200);
  expect(contents.items.some((f) => f.id === pending.fileId)).toBe(false);
  for (const suffix of ['', '/view-url', '/download-url']) expect((await apis.owner.send('GET', `/files/${pending.fileId}${suffix}`)).status).toBe(404);
  for (const overrides of [{ size: 0 }, { size: 52_428_801 }, { mimeType: 'text/plain' }]) {
    expect((await apis.owner.send('POST', '/files/upload-intent', {
      dataRoomId: s.roomId, folderId: s.root.id, name: 'rejected.pdf', size: 1, mimeType: 'application/pdf', ...overrides,
    })).status).toBe(400);
  }
});

test('PDF lifecycle preserves bytes, resolves conflicts, moves and deletes metadata', async ({ assessment: s, apis }) => {
  const source = await s.folder('Source'), destination = await s.folder('Destination');
  const bytes = pdf();
  const file = await s.upload('report.pdf', source.id, bytes);
  const duplicate = await s.upload('REPORT.pdf', source.id, bytes);
  expect(duplicate.name).toBe('REPORT (1).pdf');
  const metadata = requireStatus(await apis.owner.send<Document>('GET', `/files/${file.id}`), 200);
  expect(metadata.size).toBe(bytes.length); expect(metadata.mimeType).toBe('application/pdf');
  expect(metadata.folderId).toBe(source.id);
  const rename = requireStatus(await apis.owner.send<Document>('PATCH', `/files/${duplicate.id}`, { name: 'report.pdf' }), 200);
  expect(rename.name).toBe('report (1).pdf');
  const moved = requireStatus(await apis.owner.send<Document>('PATCH', `/files/${file.id}/move`, { targetFolderId: destination.id }), 200);
  expect(moved.id).toBe(file.id); expect(moved.folderId).toBe(destination.id);
  const stable = requireStatus(await apis.owner.send<Document>('PATCH', `/files/${file.id}/move`, { targetFolderId: destination.id }), 200);
  expect(stable.name).toBe(moved.name);
  const link = requireStatus(await apis.owner.send<{ url: string }>('GET', `/files/${file.id}/download-url`), 200);
  const downloaded = await apis.anonymous.download(link.url);
  expect(downloaded.status).toBe(200); expect(downloaded.bytes.equals(bytes)).toBe(true);
  expect(downloaded.disposition).toContain('report.pdf');
  expect((await apis.owner.send('DELETE', `/files/${file.id}`)).status).toBe(204);
  for (const suffix of ['', '/view-url', '/download-url']) expect((await apis.owner.send('GET', `/files/${file.id}${suffix}`)).status).toBe(404);
});

test('cursor pagination crosses the folder/file seam exactly once per item', async ({ assessment: s, apis }) => {
  const a = await s.folder('A'), b = await s.folder('B');
  const file = await s.upload('seam.pdf');
  const ids: string[] = [], cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: PageOf<Item> = requireStatus(await apis.owner.send<PageOf<Item>>('GET', `/folders/${s.root.id}/contents?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`), 200);
    ids.push(...page.items.map((i) => i.id)); cursor = page.nextCursor;
    if (cursor) { expect(cursors.has(cursor)).toBe(false); cursors.add(cursor); }
    expect(cursors.size).toBeLessThan(10);
  } while (cursor);
  expect(ids).toEqual([a.id, b.id, file.id]);
  expect(new Set(ids).size).toBe(3);
  expect((await apis.owner.send('GET', `/folders/${s.root.id}/contents?cursor=invalid`)).status).toBe(400);
});
