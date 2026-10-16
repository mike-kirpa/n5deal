import { test, expect } from '../../fixtures/qa';
import { requireStatus } from '../../helpers/api';
import type { Document, Item, PageOf } from '../../helpers/api';
import { pdf } from '../../helpers/shared.cjs';

// Existing resources.spec.ts already checks 0, 50 MiB + 1 and text/plain.
const boundaries: { label: string; size: unknown; status: number }[] = [
  { label: '1 byte (metadata only)', size: 1, status: 201 },
  { label: '50 MiB minus 1', size: 52_428_799, status: 201 },
  { label: 'exactly 50 MiB', size: 52_428_800, status: 201 },
  { label: 'negative', size: -1, status: 400 },
  { label: 'fractional', size: 1.5, status: 400 },
  { label: 'non-numeric', size: 'not-a-number', status: 400 },
];
for (const c of boundaries) test(`upload intent size: ${c.label}`, async ({ assessment: s, apis, evidence }) => {
  const result = await s.requestIntent({ name: 'size-boundary.pdf', size: c.size, mimeType: 'application/pdf' });
  evidence.record({ check: 'metadata size validation only; no storage PUT or completion', declaredSize: c.size, status: result.status });
  expect(result.status).toBe(c.status);
  if (result.status === 201) {
    expect(typeof result.body.fileId).toBe('string');
    expect((await apis.owner.send('GET', `/files/${result.body.fileId}`)).status).toBe(404);
    const contents = requireStatus(await apis.owner.send<PageOf<Item>>('GET', `/folders/${s.root.id}/contents`), 200);
    expect(contents.items.some(f => f.id === result.body.fileId)).toBe(false);
  }
});

for (const mimeType of ['image/png', undefined]) test(`upload intent rejects ${mimeType || 'missing MIME'}`, async ({ assessment: s, evidence }) => {
  const result = await s.requestIntent({ name: 'mime-validation.pdf', size: 10, ...(mimeType ? { mimeType } : {}) });
  evidence.record({ check: 'declared MIME validation, not content inspection', declaredMime: mimeType || 'omitted', status: result.status });
  expect(result.status).toBe(400);
});

for (const adjustment of [-11, 11]) test(`completion records actual small PDF size when declared size differs by ${adjustment}`, async ({ assessment: s, apis, evidence }) => {
  const bytes = pdf('Declared versus actual size'), declared = bytes.length + adjustment;
  const file = await s.upload('size-mismatch.pdf', s.root.id, bytes, declared);
  const metadata = requireStatus(await apis.owner.send<Document>('GET', `/files/${file.id}`), 200);
  evidence.record({ check: 'completion size reconciliation; both sizes small and within limit', declared, actual: bytes.length, recordedSize: metadata.size });
  expect(metadata.size).toBe(bytes.length);
  const link = requireStatus(await apis.owner.send<{ url: string }>('GET', `/files/${file.id}/download-url`), 200);
  const downloaded = await apis.anonymous.download(link.url);
  expect(downloaded.status).toBe(200); expect(downloaded.bytes.equals(bytes)).toBe(true);
});
