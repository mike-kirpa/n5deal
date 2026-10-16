import { test, expect } from '../../fixtures/qa';
import { environment } from '../../helpers/environment';
import { pdf } from '../../helpers/shared.cjs';

test('BUG-001 @known-bug Retry recovers after successful PUT and one failed completion', async ({ ui, assessment: s, actors }, info) => {
  info.annotations.push({ type: 'bug', description: 'BUG-001' });
  const page = await ui.page(actors.ownerToken);
  await ui.openFolder(page);
  let injected = 0;
  const puts: number[] = [];
  page.on('response', (response) => { if (response.request().method() === 'PUT') puts.push(response.status()); });
  await page.route('**/files/*/complete', (route) => {
    if (injected++ === 0) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA client-simulated completion outage' }) });
    return route.continue();
  });
  const firstPut = page.waitForResponse((r) => r.request().method() === 'PUT');
  await page.locator('input[type=file]').setInputFiles({ name: 'retry-recovery.pdf', mimeType: 'application/pdf', buffer: pdf() });
  expect((await firstPut).status()).toBe(200);
  await expect(page.getByText('QA client-simulated completion outage', { exact: true })).toBeVisible();
  expect(injected).toBe(1);
  await page.getByRole('button', { name: 'Retry upload of retry-recovery.pdf', exact: true }).click();
  const published = page.getByRole('cell', { name: 'retry-recovery.pdf', exact: true });
  const failed = page.getByText(/Upload failed with status \d+/, { exact: true });
  await expect(published.or(failed)).toBeVisible({ timeout: 20_000 });
  s.evidence.record({ observation: 'Retry after one client-local completion failure', storagePutStatuses: puts, completionRequests: injected });
  await ui.capture(page, info, 'BUG-001-retry-terminal-state');
  const knownRetry = puts.at(-1) === 400 && injected === 1 && await page.getByText('Upload failed with status 400', { exact: true }).isVisible();
  test.fail(knownRetry || await published.isVisible(), 'BUG-001: Retry repeats a no-upsert PUT and leaves the file pending');
  await expect(published).toBeVisible();
});

test('BUG-003 @known-bug failed delete preview blocks deletion or warns about unknown nested content', async ({ ui, assessment: s, actors }, info) => {
  info.annotations.push({ type: 'bug', description: 'BUG-003' });
  const parent = await s.folder('Delete parent');
  await s.folder('Nested content', parent.id);
  const page = await ui.page(actors.ownerToken);
  await ui.openFolder(page);
  await page.route(`**/folders/${parent.id}/delete-preview`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA client-simulated preview outage' }) }));
  await ui.menu(page, parent.name, 'Delete');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText("Could not check what's inside this folder.", { exact: true })).toBeVisible();
  const disabled = await dialog.getByRole('button', { name: 'Delete', exact: true }).isDisabled();
  // Error text alone does not explain the unknown destructive scope.
  const warning = await dialog.getByText(/(?:unknown|cannot determine|could not determine).*(?:content|subfolder)|(?:nested content|subfolders).*(?:unknown|not checked|could not be checked)/i).count();
  s.evidence.record({ observation: 'Delete preview failed locally; destructive action not clicked', deleteDisabled: disabled, unknownContentWarnings: warning });
  await ui.capture(page, info, 'BUG-003-delete-preview-error');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  test.fail(true, 'BUG-003: Delete stays enabled without an explicit unknown-content warning');
  expect(disabled || warning > 0).toBe(true);
});

test('BUG-004 @known-bug a nested folder has a keyboard-operable open action', async ({ ui, assessment: s, actors }, info) => {
  info.annotations.push({ type: 'bug', description: 'BUG-004' });
  const folder = await s.folder('Keyboard destination');
  const page = await ui.page(actors.ownerToken);
  await ui.openFolder(page);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: folder.name, exact: true }) });
  await expect(row).toBeVisible();
  const semantics = await row.evaluate((el) => ({ tag: el.tagName, tabIndex: (el as HTMLElement).tabIndex, role: el.getAttribute('role'), links: el.querySelectorAll('a').length }));
  await page.getByRole('button', { name: 'New folder', exact: true }).first().focus();
  const visited: unknown[] = [];
  for (let i = 0; i < 30 && new URL(page.url()).pathname !== `/folder/${folder.id}`; i++) {
    await page.keyboard.press('Tab');
    const target = await row.evaluate((el) => {
      const active = document.activeElement as HTMLElement | null;
      return { inside: !!active && el.contains(active), tag: active?.tagName, role: active?.getAttribute('role'), name: active?.getAttribute('aria-label') || active?.textContent?.trim().slice(0, 100) };
    });
    visited.push(target);
    if (!target.inside) continue;
    await page.keyboard.press('Enter');
    if (await page.getByRole('menu').isVisible()) {
      const open = page.getByRole('menuitem', { name: /^(Open|Open folder)$/i });
      if (await open.count()) { await open.focus(); await page.keyboard.press('Enter'); }
      else await page.keyboard.press('Escape');
    }
  }
  s.evidence.record({ observation: 'Real Tab/Enter traversal; no mouse click or direct folder navigation', semantics, visited });
  await ui.capture(page, info, 'BUG-004-keyboard-navigation');
  test.fail(true, 'BUG-004: folder row is skipped by Tab and its action menu has no Open command');
  await expect(page).toHaveURL(`${environment.webURL}/folder/${folder.id}`);
});
