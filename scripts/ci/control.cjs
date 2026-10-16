// CI orchestration/aggregation only; the existing safe reporter owns test results.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const artifactRoot = path.join(root, 'artifacts');
const mode = process.argv[2];

function fingerprint(directory) {
  const hash = createHash('sha256');
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, e.name); hash.update(path.relative(directory, file));
      if (e.isDirectory()) visit(file); else hash.update(fs.readFileSync(file));
    }
  }
  visit(directory); return hash.digest('hex');
}
function runPrefix() {
  const prefix = process.env.QA_CI_PREFIX;
  if (!prefix || !/^ci-[A-Za-z0-9_-]{1,80}$/.test(prefix)) throw new Error('Invalid or missing QA_CI_PREFIX');
  return prefix;
}
function report(phase) {
  const id = `${runPrefix()}-${phase}`;
  const file = path.join(artifactRoot, 'automation', id, 'results.json');
  if (!fs.existsSync(file)) return null;
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (r.runId !== id || !Array.isArray(r.tests) || !Array.isArray(r.globalErrors)) throw new Error('Invalid current-run report');
  return r;
}
function safeTeardown(r) {
  return r && r.tests.length > 0 && r.globalErrors.length === 0 && r.tests.every((t) =>
    ['passed', 'not-needed'].includes(t.cleanup) && !['cleanup-failure', 'automation-failure', 'environment-failure'].includes(t.classification));
}

(async () => {
  if (mode === 'preflight') {
    try {
      const { validateEnvironment } = await import(pathToFileURL(path.join(root, 'helpers/environment.ts')).href);
      validateEnvironment();
      console.log('CI preflight passed: documented accounts and configuration present; no login performed.');
    } catch {
      throw new Error('CI preflight failed: configure QA_OWNER_PASSWORD / QA_VIEWER_PASSWORD, documented emails and valid target URLs. Values omitted.');
    }
  } else if (mode === 'discover') {
    const before = fingerprint(artifactRoot);
    // Empty values prevent a local .env from supplying credentials; accidental execution cannot reach the deployed target.
    const env = { ...process.env, CI: 'true', QA_OWNER_PASSWORD: '', QA_VIEWER_PASSWORD: '', QA_STORAGE_UPLOAD_KEY: '',
      QA_OWNER_EMAIL: 'john@example.com', QA_VIEWER_EMAIL: 'viewer@example.com', QA_RUN_ID: 'static-discovery',
      BASE_URL: 'http://127.0.0.1:1', API_BASE_URL: 'http://127.0.0.1:1', DEBUG: '', PWDEBUG: '' };
    const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--list'], { cwd: root, env, encoding: 'utf8' });
    process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
    if (result.status !== 0 || !/Collected [1-9]\d* tests; none executed\./.test(result.stdout || '') || fingerprint(artifactRoot) !== before) {
      throw new Error('Static discovery failed or changed test artifacts; no integration execution is authorized here.');
    }
    console.log('Static guard passed: all projects collected, no fixtures/test execution, artifact tree unchanged.');
  } else if (mode === 'cleanup') {
    if (!safeTeardown(report('stable'))) throw new Error('Stable teardown missing/unsafe: further integration mutations blocked; inspect sanitized diagnostics.');
    console.log('Stable teardown recorded as safe; known-defect suite may proceed. Physical storage removal is not proven.');
  } else if (mode === 'summary') {
    const prefix = runPrefix();
    const steps = ['CREDENTIALS', 'BROWSERS', 'STABLE', 'CLEANUP', 'KNOWN', 'AUDIT', 'UPLOAD'];
    const outcomes = Object.fromEntries(steps.map((name) => [name, process.env[`${name}_OUTCOME`] || 'not-run']));
    const safe = outcomes.AUDIT === 'success';
    const reports = safe ? [report('stable'), report('known')] : [null, null];
    const tests = reports.flatMap((r) => r?.tests || []);
    const count = (classification) => tests.filter((t) => t.classification === classification).length;
    const unexpected = ['unexpected-failure', 'unexpected-pass', 'environment-failure', 'automation-failure', 'cleanup-failure'];
    const validClassifications = ['passed', 'expected-failure', 'skipped', ...unexpected];
    const globalErrors = reports.reduce((n, r) => n + (r?.globalErrors.length || 0), 0);
    const complete = reports.every(Boolean);
    const badResults = !complete || globalErrors > 0 || tests.some((t) => !validClassifications.includes(t.classification)
      || unexpected.includes(t.classification) || t.classification === 'skipped' || !['passed', 'not-needed'].includes(t.cleanup))
      || reports.some((r) => r && (r.effectiveStatus !== 'passed' || r.tests.length === 0));
    const failed = !safe || badResults || Object.values(outcomes).some((v) => v !== 'success');
    let markdown = `# N5Deal QA — Playwright Execution\n\nDate (UTC): ${new Date().toISOString()}\n\nRun: ${prefix}\n\n`;
    markdown += `Overall CI result (checks completed so far): **${failed ? 'FAILED' : 'PASSED'}**.\n\n`;
    markdown += '| Phase | Outcome |\n|---|---|\n' + Object.entries(outcomes).map(([k, v]) => `| ${k} | ${['success', 'failure', 'skipped', 'cancelled', 'not-run'].includes(v) ? v : 'invalid'} |`).join('\n') + '\n\n';
    if (!safe) markdown += 'Artifact safety check did not pass. Reports withheld; test counts are unavailable, not zero.\n';
    else {
      markdown += `${complete ? 'Complete' : 'Partial'} recorded results; absent phases are not passes.\n\n`;
      markdown += '| Metric | Recorded count |\n|---|---:|\n' + [
        ['API passed', tests.filter((t) => t.project === 'api' && t.classification === 'passed').length],
        ['Browser E2E passed', tests.filter((t) => t.project === 'chromium' && t.classification === 'passed').length],
        ['Expected failed (known bugs)', count('expected-failure')], ['Unexpected failed', count('unexpected-failure')],
        ['Unexpected passed', count('unexpected-pass')], ['Skipped', count('skipped')],
        ['Blocked / environment failure', count('environment-failure')], ['Automation failure', count('automation-failure')],
        ['Cleanup failure', tests.filter((t) => t.classification === 'cleanup-failure' || t.cleanup === 'failed').length],
        ['Cleanup passed', tests.filter((t) => t.cleanup === 'passed').length],
        ['Cleanup not needed', tests.filter((t) => t.cleanup === 'not-needed').length], ['Runner/global errors', globalErrors],
      ].map(([name, n]) => `| ${name} | ${n} |`).join('\n') + '\n\n';
      const bugs = [...new Set(tests.filter((t) => t.classification === 'expected-failure').flatMap((t) => t.bugs || []))].filter((id) => /^BUG-\d{3}$/.test(id));
      markdown += `Expected-failed bugs: ${bugs.join(', ') || 'none recorded'}. Expected failures are NOT successful product behavior.\n`;
    }
    markdown += '\nCleanup describes API metadata teardown, not verified physical object removal. Cancellation/runner loss can interrupt cleanup; do not overlap local runs.\n';
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    else process.stdout.write(markdown);
    if (failed) process.exitCode = 1;
  } else throw new Error('Use preflight, discover, cleanup or summary.');
})().catch(() => {
  const message = mode === 'preflight'
    ? 'EnvironmentError: configure QA_OWNER_PASSWORD and QA_VIEWER_PASSWORD, documented emails and valid URLs; values omitted.'
    : `CI ${['discover', 'cleanup', 'summary'].includes(mode) ? mode : 'control'} failed; missing/unsafe configuration or evidence. No raw data printed.`;
  console.error(message);
  if (mode === 'summary' && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '# N5Deal QA\n\nFAILED: CI summary unavailable due to missing/invalid current-run evidence. No raw data published.\n');
  process.exitCode = 1;
});
