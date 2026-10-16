import { test, expect } from '../../fixtures/qa';
import { pdf } from '../../helpers/shared.cjs';

for (const mimeType of ['text/plain', 'image/png']) test(`browser rejects declared ${mimeType} before upload intent`, async ({ ui, actors, evidence }) => {
  const page = await ui.page(actors.ownerToken);
  await ui.openFolder(page);
  let intents = 0;
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/files/upload-intent') intents++; });
  await page.locator('input[type=file]').setInputFiles({ name: 'not-a-pdf.pdf', mimeType, buffer: Buffer.from('Synthetic non-PDF file') });
  await expect(page.getByText('not-a-pdf.pdf is not a PDF', { exact: true })).toBeVisible();
  expect(intents).toBe(0);
  evidence.record({ check: 'Browser declared MIME rejection despite PDF extension', declaredMime: mimeType, uploadIntentRequests: intents });
});

test('browser falls back to PDF extension when file MIME is empty', async ({ ui, actors, evidence }) => {
  const page = await ui.page(actors.ownerToken); await ui.openFolder(page);
  const intentEvent = page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/files/upload-intent');
  await page.locator('input[type=file]').setInputFiles({ name: 'empty-mime.pdf', mimeType: '', buffer: pdf() });
  const declared = (await intentEvent).postDataJSON() as { mimeType: string };
  expect(declared.mimeType).toBe('application/pdf');
  await expect(page.getByRole('cell', { name: 'empty-mime.pdf', exact: true })).toBeVisible({ timeout: 20_000 });
  evidence.record({ observation: 'Browser infers PDF MIME from extension; API missing-MIME validation is separate', submittedMime: declared.mimeType });
});
