import { test, expect } from '../../fixtures/qa';
import { pdf } from '../../helpers/shared.cjs';

test('batch uploads isolate a pre-storage failure, show per-file progress and recover through Retry', async ({ ui, actors, assessment: s, evidence }) => {
  const page = await ui.page(actors.ownerToken); await ui.openFolder(page);
  let release!: () => void, completionReached!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const waiting = new Promise<void>(resolve => { completionReached = resolve; });
  let rejectedOnce = false, heldOnce = false;
  const storage = '**/storage/v1/object/upload/sign/**', complete = '**/files/*/complete';
  await page.route(storage, async route => {
    if (!rejectedOnce && route.request().method() === 'PUT' && route.request().postDataBuffer()?.includes(Buffer.from('retry-before-storage.pdf'))) {
      rejectedOnce = true;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Client-local pre-storage failure"}' });
    } else await route.continue();
  });
  await page.route(complete, async route => {
    if (!heldOnce && route.request().method() === 'POST') {
      heldOnce = true; completionReached(); await gate;
    }
    await route.continue();
  });
  const row = (name: string) => page.getByRole('listitem').filter({ has: page.locator(`span[title="${name}"]`) });
  try {
    await page.locator('input[type=file]').setInputFiles([
      { name: 'retry-before-storage.pdf', mimeType: 'application/pdf', buffer: pdf('Batch retry') },
      { name: 'batch-success.pdf', mimeType: 'application/pdf', buffer: pdf('Batch success') },
    ]);
    // Bounded by the test timeout; finally always releases the route.
    await waiting;
    await expect(row('retry-before-storage.pdf').getByText('Error', { exact: true })).toBeVisible();
    await expect(row('batch-success.pdf').getByText('Uploading', { exact: true })).toBeVisible();
    await expect(row('batch-success.pdf').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByRole('cell', { name: 'retry-before-storage.pdf', exact: true })).toHaveCount(0);
    release();
    await expect(row('batch-success.pdf').getByText('Done', { exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'batch-success.pdf', exact: true })).toBeVisible();
    await row('retry-before-storage.pdf').getByRole('button', { name: 'Retry upload of retry-before-storage.pdf', exact: true }).click();
    await expect(row('retry-before-storage.pdf').getByText('Done', { exact: true })).toBeVisible({ timeout: 20_000 });
    for (const name of ['retry-before-storage.pdf', 'batch-success.pdf']) await expect(page.getByRole('cell', { name, exact: true })).toHaveCount(1);
    expect(rejectedOnce).toBe(true); expect(heldOnce).toBe(true);
    await s.flush();
    evidence.record({ check: 'Two-file batch; browser-local failure before storage acceptance, not BUG-001 completion failure', failedFileRetried: true, unaffectedFilePublished: true, progressAtCompletionGate: 100 });
  } finally { release(); await page.unroute(storage); await page.unroute(complete); }
});
