// Explicit local convenience launcher; credentials stay in child-process memory.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readAssessmentReadme } = require('../helpers/shared.cjs');
const { webURL, apiURL, accounts } = readAssessmentReadme(process.env.QA_README_PATH || path.resolve(__dirname, '../../virtual-data-room/README.md'));
const env = { ...process.env, BASE_URL: webURL, API_BASE_URL: apiURL,
  QA_BROWSER_CHANNEL: process.env.QA_BROWSER_CHANNEL || 'chrome',
  QA_OWNER_EMAIL: accounts[0].email, QA_OWNER_PASSWORD: accounts[0].password,
  QA_VIEWER_EMAIL: accounts[1].email, QA_VIEWER_PASSWORD: accounts[1].password };
const args = process.argv.slice(2);
if (!args.some((arg) => arg.startsWith('--project'))) args.unshift('--project=api', '--project=chromium');
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...args], { stdio: 'inherit', env });
if (result.error) { console.error('EnvironmentError: Playwright process could not start'); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
