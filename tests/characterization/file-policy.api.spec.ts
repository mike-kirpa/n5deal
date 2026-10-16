import { test, expect } from '../../fixtures/qa';
import { requireStatus } from '../../helpers/api';
import type { Document } from '../../helpers/api';
import { pdf } from '../../helpers/shared.cjs';

test('characterize non-PDF filename extension separately from declared PDF MIME', async ({ assessment: s, evidence }) => {
  const result = await s.requestIntent({ name: 'extension-check.txt', size: pdf().length, mimeType: 'application/pdf' });
  evidence.record({ observation: 'Filename extension policy; no storage bytes sent', name: 'extension-check.txt', declaredMime: 'application/pdf', status: result.status, extensionRejected: result.status === 400 });
  // No extension requirement is defined. This is a characterization, not a PDF-validity assertion.
  expect([201, 400]).toContain(result.status);
  if (result.status === 201) expect(result.body.name).toBe('extension-check.txt');
});

const candidates = [
  { label: 'non-PDF bytes', name: 'plain-bytes.pdf', bytes: Buffer.from('N5Deal synthetic plain text, not a PDF.\n') },
  { label: 'corrupted PDF', name: 'corrupted.pdf', bytes: pdf().subarray(0, 40) },
];
for (const c of candidates) test(`characterize actual content: ${c.label} with PDF name and MIME`, async ({ assessment: s, apis, evidence }) => {
  const intent = await s.intent(c.name, s.root.id, c.bytes.length);
  const storageStatus = await s.uploadBytes(intent, c.name, c.bytes);
  evidence.record({ observation: 'Small synthetic content-policy probe; acceptance is not proof of valid PDF content', candidate: c.label, byteCount: c.bytes.length, storageStatus });
  expect([200, 400, 415]).toContain(storageStatus);
  if (storageStatus !== 200) return;
  const completion = await apis.owner.send('POST', `/files/${intent.fileId}/complete`);
  evidence.record({ observation: 'Actual content completion', candidate: c.label, completionStatus: completion.status, published: completion.status === 201 });
  expect([201, 400, 415]).toContain(completion.status);
  if (completion.status === 201) {
    const metadata = requireStatus(await apis.owner.send<Document>('GET', `/files/${intent.fileId}`), 200);
    expect(metadata.size).toBe(c.bytes.length);
    const link = requireStatus(await apis.owner.send<{ url: string }>('GET', `/files/${intent.fileId}/download-url`), 200);
    const downloaded = await apis.anonymous.download(link.url);
    expect(downloaded.status).toBe(200); expect(downloaded.bytes.equals(c.bytes)).toBe(true);
    evidence.record({ observation: 'Content accepted unchanged; requirement/impact review needed, not automatically a defect', candidate: c.label, actualSize: metadata.size, declaredMime: metadata.mimeType });
  }
});
