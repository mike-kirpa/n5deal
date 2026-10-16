import { test, expect } from '../../fixtures/qa';
import { environment } from '../../helpers/environment';

test('Owner logs in, creates a folder, uploads and opens a PDF, then downloads it', async ({ ui, assessment: s }) => {
  const page = await ui.page();
  await ui.login(page);
  await ui.openFolder(page);
  await ui.createFolder(page, 'Browser documents');
  await page.getByRole('cell', { name: 'Browser documents', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Browser documents', { exact: true })).toBeVisible();
  await ui.upload(page, 'browser-document.pdf');
  await page.getByRole('cell', { name: 'browser-document.pdf', exact: true }).click();
  await expect(page.locator('object[type="application/pdf"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'browser-document.pdf', exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await ui.menu(page, 'browser-document.pdf', 'Download');
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('browser-document.pdf');
  expect(await download.failure()).toBeNull();
  await download.delete();
});

test('Owner shares in the UI; an independent Viewer context browses read-only descendants', async ({ ui, assessment: s, actors }) => {
  const child = await s.folder('Shared documents');
  await s.upload('shared-document.pdf', child.id);
  const owner = await ui.page(actors.ownerToken);
  await ui.openFolder(owner);
  await owner.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill(environment.viewer.email);
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(dialog.getByText(environment.viewer.email, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await s.flush();
  const viewer = await ui.page(actors.viewerToken);
  await ui.openFolder(viewer, s.root.id, true);
  await expect(viewer.getByRole('cell', { name: child.name, exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'New folder', exact: true })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Upload', exact: true })).toHaveCount(0);
  await viewer.getByRole('cell', { name: child.name, exact: true }).click();
  await expect(viewer.getByRole('cell', { name: 'shared-document.pdf', exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Actions for shared-document.pdf', exact: true }).click();
  await expect(viewer.getByRole('menuitem', { name: 'Download', exact: true })).toBeVisible();
  for (const name of ['Rename', 'Move', 'Delete', 'Share']) await expect(viewer.getByRole('menuitem', { name, exact: true })).toHaveCount(0);
  await viewer.keyboard.press('Escape');
  await viewer.getByRole('cell', { name: 'shared-document.pdf', exact: true }).click();
  await expect(viewer.locator('object[type="application/pdf"]')).toBeVisible();
});

test('Logout removes the session; switching to Viewer does not reuse Owner content or permissions', async ({ ui, assessment: s, actors }) => {
  await s.folder('Owner private content');
  const page = await ui.page(actors.ownerToken);
  await ui.openFolder(page);
  await expect(page.getByRole('cell', { name: 'Owner private content', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(`${environment.webURL}/login`);
  expect(await page.evaluate(() => localStorage.getItem('dataroom_token'))).toBeNull();
  await page.goto(`${environment.webURL}/folder/${s.root.id}`);
  await expect(page).toHaveURL(`${environment.webURL}/login`);
  await ui.login(page, environment.viewer);
  await expect(page.getByText(s.root.name, { exact: true })).toHaveCount(0);
  await page.goto(`${environment.webURL}/folder/${s.root.id}`);
  await expect(page.getByText(/Folder not found/i).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Owner private content', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New folder', exact: true })).toHaveCount(0);
});
