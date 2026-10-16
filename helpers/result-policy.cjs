'use strict';

function classifyResult({ cleanupFailure, infrastructureFailure, environmentFailure, expectedStatus, status }) {
  return cleanupFailure ? 'cleanup-failure' : infrastructureFailure ? 'automation-failure' : environmentFailure ? 'environment-failure'
    : expectedStatus === 'failed' && status === 'failed' ? 'expected-failure'
    : expectedStatus === 'failed' && status === 'passed' ? 'unexpected-pass'
    : status === 'passed' ? 'passed' : status === 'skipped' ? 'skipped' : 'unexpected-failure';
}

// A failed storage service is not evidence that a capability expired.
function expirationOutcome(expiredStatus, controlStatus, controlMatches) {
  if (controlStatus !== 200 || !controlMatches || expiredStatus >= 500 || [408, 425, 429].includes(expiredStatus)) return 'inconclusive';
  return expiredStatus >= 400 && expiredStatus < 500 ? 'denied' : 'accessible';
}
module.exports = { classifyResult, expirationOutcome };
