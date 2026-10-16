import { test, expect } from '../../fixtures/qa';
import { pdf } from '../../helpers/shared.cjs';

test('characterize browser extension policy with a valid PDF and declared PDF MIME', async ({ ui, actors, evidence }) => {
  const page = await ui.page(actors.ownerToken); await ui.openFolder(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'valid-content.txt', mimeType: 'application/pdf', buffer: pdf() });
  await expect(page.getByRole('cell', { name: 'valid-content.txt', exact: true })).toBeVisible({ timeout: 20_000 });
  evidence.record({ observation: 'Browser uses declared PDF MIME rather than extension; no extension rejection requirement is defined', fileName: 'valid-content.txt', declaredMime: 'application/pdf', published: true });
});
