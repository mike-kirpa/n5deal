const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyResult, expirationOutcome } = require('../../helpers/result-policy.cjs');
const { createRedactor } = require('../../helpers/shared.cjs');

test('expected defects are distinct from passes and unexpected fixes', () => {
  assert.equal(classifyResult({ expectedStatus: 'failed', status: 'failed' }), 'expected-failure');
  assert.equal(classifyResult({ expectedStatus: 'failed', status: 'passed' }), 'unexpected-pass');
  assert.equal(classifyResult({ expectedStatus: 'passed', status: 'passed' }), 'passed');
  assert.equal(classifyResult({ expectedStatus: 'passed', status: 'failed' }), 'unexpected-failure');
  assert.equal(classifyResult({ expectedStatus: 'passed', status: 'skipped' }), 'skipped');
});
test('cleanup, harness and environment failures override known-defect markers', () => {
  const known = { expectedStatus: 'failed', status: 'failed' };
  assert.equal(classifyResult({ ...known, cleanupFailure: true, infrastructureFailure: true }), 'cleanup-failure');
  assert.equal(classifyResult({ ...known, infrastructureFailure: true }), 'automation-failure');
  assert.equal(classifyResult({ ...known, environmentFailure: true }), 'environment-failure');
});
test('expiry requires an explicit denial and a healthy same-file positive control', () => {
  for (const status of [400, 401, 403, 404, 410]) assert.equal(expirationOutcome(status, 200, true), 'denied');
  for (const status of [200, 206, 302]) assert.equal(expirationOutcome(status, 200, true), 'accessible');
  for (const status of [408, 425, 429, 500, 503]) assert.equal(expirationOutcome(status, 200, true), 'inconclusive');
  assert.equal(expirationOutcome(403, 503, true), 'inconclusive');
  assert.equal(expirationOutcome(403, 200, false), 'inconclusive');
});
test('redaction removes registered literals, nested credentials, URLs and JWTs without mutating input', () => {
  const redactor = createRedactor(['synthetic-private-value']);
  const fakeJwt = [{ alg: 'HS256' }, { sub: 'synthetic' }].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.c2lnbmF0dXJl';
  const fakeUrl = 'https://example.invalid/object?' + 'token=fake';
  const input = { password: 'example', nested: { accessToken: 'example-token' }, message: `synthetic-private-value ${fakeUrl} ${fakeJwt}` };
  const before = JSON.stringify(input), output = JSON.stringify(redactor.redact(input));
  for (const value of ['example-token', 'synthetic-private-value', 'https://', 'eyJhbGci']) assert.equal(output.includes(value), false);
  assert.equal(JSON.stringify(input), before);
  assert.equal(output.includes('"password":"example"'), false);
});
