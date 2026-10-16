// Explicit opt-in only. Existing fixtures/reporter remain responsible for lifecycle and privacy.
const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--project=extended', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, QA_RUN_EXPIRATION: '1' },
});
if (result.error) { console.error('EnvironmentError: opt-in Playwright process could not start'); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
