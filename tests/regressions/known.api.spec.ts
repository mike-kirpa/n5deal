import { test, expect } from '../../fixtures/qa';

test('BUG-002 @known-bug completion without uploaded bytes returns a client error', async ({ assessment: s, apis }, info) => {
  info.annotations.push({ type: 'bug', description: 'BUG-002' });
  const intent = await s.intent('missing-bytes.pdf');
  const completion = await apis.owner.send<{ message: string }>('POST', `/files/${intent.fileId}/complete`);
  // Setup/transport/cleanup failures must not be treated as the known assertion failure.
  const knownResponse = completion.status === 500 && completion.body.message === 'Could not verify the upload';
  test.fail(knownResponse || completion.status === 400, 'BUG-002: missing storage object currently produces HTTP 500 instead of validation HTTP 400');
  expect(completion.status).toBe(400);
});
