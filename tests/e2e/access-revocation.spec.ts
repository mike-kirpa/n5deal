import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/qa';
import { environment } from '../../helpers/environment';
import { privacy, requireStatus } from '../../helpers/api';
import { fileReads } from '../../helpers/revocation';
import { pdf } from '../../helpers/shared.cjs';

function watchIssuance(page: Page, fileId: string) {
  const rows: { endpoint: string; status: number }[] = [];
  page.on('response', r => {
    const url = new URL(r.url());
    if (url.origin === environment.apiURL && url.pathname.startsWith(`/files/${fileId}/`) && /\/(view|download)-url$/.test(url.pathname)) {
      rows.push({ endpoint: url.pathname, status: r.status() });
    }
  });
  return rows;
}

test('an opened PDF is observed after direct USER revocation; fresh download and reload are denied', async ({ assessment: s, apis, actors, ui, evidence }) => {
  const bytes = pdf('Opened PDF revocation');
  const file = await s.upload('opened-document.pdf', s.root.id, bytes);
  const grant = await s.share('FILE', file.id);
  const owner = await ui.page(actors.ownerToken), viewer = await ui.page(actors.viewerToken);
  await ui.openFolder(owner);
  const signedResponse = viewer.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}/view-url`);
  await viewer.goto(`${environment.webURL}/shared-with-me/file/${file.id}`);
  const response = await signedResponse;
  expect(response.status()).toBe(200);
  const issued = await response.json() as { url: string }; privacy.protect(issued.url);
  const loaded = await apis.anonymous.download(issued.url, true);
  expect(loaded.status).toBe(200); expect(loaded.bytes.equals(bytes)).toBe(true);
  await expect(viewer.locator('object[type="application/pdf"]')).toBeVisible();
  await ui.menu(owner, file.name, 'Share');
  const dialog = owner.getByRole('dialog');
  const accessRow = dialog.getByRole('listitem').filter({ hasText: environment.viewer.email });
  const revoked = owner.waitForResponse(r => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/shares/${grant.id}`);
  await accessRow.getByRole('button', { name: 'Revoke', exact: true }).click();
  expect((await revoked).status()).toBe(204);
  s.shares.get(grant.id)!.revoked = true;
  await expect(accessRow).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  evidence.record({ check: 'Owner revoked direct FILE access through the sharing dialog', status: 204 });
  evidence.record({ observation: 'Already-open document immediately after revoke; object presence is not proof of rendered pages', pdfObjectVisible: await viewer.locator('object[type="application/pdf"]').isVisible() });
  const issuance = watchIssuance(viewer, file.id);
  const deniedDownload = viewer.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}/download-url`);
  await viewer.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await deniedDownload).status()).toBe(404);
  await expect(viewer.getByText('Resource not found', { exact: true }).first()).toBeVisible();
  const deniedMetadata = viewer.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}`);
  await viewer.reload(); expect((await deniedMetadata).status()).toBe(404);
  await expect(viewer.getByText('File not found', { exact: true })).toBeVisible();
  await expect(viewer.locator('object[type="application/pdf"]')).toHaveCount(0);
  await fileReads(apis.viewer, file.id, 404); await fileReads(apis.owner, file.id, 200);
  expect(issuance.some(r => r.status >= 200 && r.status < 300)).toBe(false);
  evidence.record({ observation: 'Fresh browser issuance after revoke', issuance, feedback: 'File not found after reload' });
});

test('folder and PDF tabs distinguish cached content from fresh access after inherited revocation', async ({ assessment: s, apis, actors, ui, evidence }) => {
  const folder = await s.folder('Two-tab share'), sibling = await s.folder('Private sibling');
  const file = await s.upload('two-tab.pdf', folder.id);
  const grant = await s.share('FOLDER', folder.id);
  const listing = await ui.page(actors.viewerToken);
  await ui.openFolder(listing, folder.id, true);
  await expect(listing.getByRole('cell', { name: 'two-tab.pdf', exact: true })).toBeVisible();
  const document = await listing.context().newPage(); document.setDefaultTimeout(10_000); s.track(document);
  const initialView = document.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}/view-url`);
  await document.goto(`${environment.webURL}/shared-with-me/file/${file.id}`);
  expect((await initialView).status()).toBe(200);
  await expect(document.locator('object[type="application/pdf"]')).toBeVisible();
  await s.revoke(grant.id);
  evidence.record({ observation: 'Two existing tabs immediately after revocation; stale UI is not a new API grant', cachedFileNameVisible: await listing.getByRole('cell', { name: 'two-tab.pdf', exact: true }).isVisible(), openPdfObjectVisible: await document.locator('object[type="application/pdf"]').isVisible() });
  const issuance = [...[listing, document].map(page => watchIssuance(page, file.id))];
  const freshMetadata = listing.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}`);
  await listing.getByRole('cell', { name: 'two-tab.pdf', exact: true }).click();
  expect((await freshMetadata).status()).toBe(404);
  await expect(listing.getByText('File not found', { exact: true })).toBeVisible();
  await document.reload(); await expect(document.getByText('File not found', { exact: true })).toBeVisible();
  await listing.goto(`${environment.webURL}/shared-with-me/folder/${folder.id}`);
  await expect(listing.getByText('Folder not found', { exact: true })).toBeVisible();
  await listing.reload(); await expect(listing.getByText('Folder not found', { exact: true })).toBeVisible();
  for (const id of [s.root.id, sibling.id]) {
    await listing.goto(`${environment.webURL}/shared-with-me/folder/${id}`);
    await expect(listing.getByText('Folder not found', { exact: true })).toBeVisible();
  }
  await fileReads(apis.viewer, file.id, 404);
  expect(issuance.flat().some(r => r.status >= 200 && r.status < 300)).toBe(false);
  evidence.record({ observation: 'Reload/navigation deny fresh access in both tabs', issuance: issuance.flat() });
});

test('a download URL authorized before revocation can finish under a client-local response delay; the next request is denied', async ({ assessment: s, apis, actors, ui, evidence }) => {
  const bytes = pdf('Controlled download revocation');
  const file = await s.upload('delayed-download.pdf', s.root.id, bytes);
  const grant = await s.share('FILE', file.id);
  const viewer = await ui.page(actors.viewerToken);
  await viewer.goto(`${environment.webURL}/shared-with-me/file/${file.id}`);
  await expect(viewer.locator('object[type="application/pdf"]')).toBeVisible();
  let release!: () => void, issued!: (status: number) => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const authorized = new Promise<number>(resolve => { issued = resolve; });
  const pattern = `**/files/${file.id}/download-url`;
  await viewer.route(pattern, async route => {
    try {
      const response = await route.fetch();
      const body = await response.json() as { url?: string }; privacy.protect(body.url);
      issued(response.status());
      await gate;
      await route.fulfill({ response, json: body });
    } catch { issued(0); await route.abort().catch(() => {}); }
  });
  const downloadEvent = viewer.waitForEvent('download');
  // Register a handler immediately so a failed prerequisite cannot leave an unhandled promise.
  void downloadEvent.catch(() => {});
  try {
    await viewer.getByRole('button', { name: 'Download', exact: true }).click();
    expect(await authorized).toBe(200);
    await s.revoke(grant.id);
    release();
    const download = await downloadEvent;
    try {
      expect(await download.failure()).toBeNull();
      const stream = await download.createReadStream();
      const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
    } finally { await download.delete(); }
    await viewer.unroute(pattern);
    const denied = viewer.waitForResponse(r => new URL(r.url()).pathname === `/files/${file.id}/download-url`);
    await viewer.getByRole('button', { name: 'Download', exact: true }).click();
    expect((await denied).status()).toBe(404);
    await fileReads(apis.viewer, file.id, 404);
    evidence.record({ observation: 'Client-local delay of already-authorized download URL response, not storage transfer interruption', previouslyAuthorizedDownloadMatched: true, freshDownloadStatus: 404 });
  } finally { release(); await viewer.unroute(pattern); }
});
