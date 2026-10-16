import { test, expect } from '../../fixtures/qa';
import { environment } from '../../helpers/environment';
import { fileReads } from '../../helpers/revocation';

test('markup-like folder names remain literal text in Owner, Viewer and public listings', async ({ assessment: s, actors, ui, evidence }) => {
  const name = '<b>QA & "quotes"</b>';
  await s.folder(name);
  await s.share('FOLDER', s.root.id);
  const link = await s.share('FOLDER', s.root.id, 'PUBLIC_LINK');
  const owner = await ui.page(actors.ownerToken), viewer = await ui.page(actors.viewerToken), publicPage = await ui.page();
  await ui.openFolder(owner); await ui.openFolder(viewer, s.root.id, true);
  await publicPage.goto(`${environment.webURL}/share/${link.token}`);
  for (const page of [owner, viewer, publicPage]) {
    const cell = page.getByRole('cell', { name, exact: true });
    await expect(cell).toBeVisible(); await expect(cell.locator('b')).toHaveCount(0);
  }
  evidence.record({ check: 'Harmless markup rendered literally in three listing surfaces; not a comprehensive XSS assessment', surfaces: ['Owner', 'Viewer', 'public'] });
});

test('Owner deletes an owned child folder while Viewer is inside it; fresh access is denied', async ({ assessment: s, apis, actors, ui, evidence }) => {
  const child = await s.folder('Delete while viewing');
  const file = await s.upload('deleted-child.pdf', child.id);
  // Share the surviving root so cleanup can still revoke the grant after child deletion.
  await s.share('FOLDER', s.root.id);
  const owner = await ui.page(actors.ownerToken), viewer = await ui.page(actors.viewerToken);
  await ui.openFolder(owner); await ui.openFolder(viewer, child.id, true);
  await expect(viewer.getByRole('cell', { name: file.name, exact: true })).toBeVisible();
  await ui.menu(owner, child.name, 'Delete');
  const dialog = owner.getByRole('dialog');
  await expect(dialog.getByText(/1 file/)).toBeVisible();
  const deleted = owner.waitForResponse(r => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/folders/${child.id}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  expect((await deleted).status()).toBe(204); await expect(dialog).toBeHidden();
  await viewer.reload(); await expect(viewer.getByText('Folder not found', { exact: true })).toBeVisible();
  await fileReads(apis.viewer, file.id, 404);
  expect((await apis.viewer.send('GET', `/folders/${s.root.id}/contents`)).status).toBe(200);
  evidence.record({ check: 'Deleted child becomes inaccessible; surviving root grant is retained only until fixture cleanup', deleteStatus: 204, freshChildStatus: 404 });
});
