const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const qaRoot = path.resolve(__dirname, '../..');
const appRoot = path.resolve(qaRoot, '../virtual-data-room');
const { readAssessmentReadme, requestAccessToken, createRedactor, pdf, resolveClientUploadKey } = require('../../helpers/shared.cjs');
const { webURL, apiURL, accounts } = readAssessmentReadme(path.join(appRoot, 'README.md'));
function loadPlaywright() {
  if (process.env.N5_PLAYWRIGHT_MODULE) return require(process.env.N5_PLAYWRIGHT_MODULE);
  try { return require('playwright'); } catch {}
  const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
  for (const entry of fs.readdirSync(cache)) {
    const candidate = path.join(cache, entry, 'node_modules', 'playwright');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return require(candidate);
  }
  throw new Error('Playwright unavailable');
}
const playwright = loadPlaywright();
const { protect, redact } = createRedactor(accounts.map((a) => a.password));
function session(label) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`;
  const artifactDir = path.join(qaRoot, 'artifacts', runId);
  fs.mkdirSync(artifactDir, { recursive: true });
  const startedAt = new Date().toISOString(), checks = [], http = [], consoleEvents = [];
  function save() { fs.writeFileSync(path.join(artifactDir, 'execution.json'), JSON.stringify(redact({ runId, startedAt, updatedAt: new Date().toISOString(), checks, http, consoleEvents }), null, 2)); }
  async function check(id, title, fn) {
    const start = Date.now();
    try { checks.push({ id, title, status: 'passed', details: await fn(), durationMs: Date.now() - start }); }
    catch (e) { checks.push({ id, title, status: e.blocked ? 'blocked' : 'failed', error: redact(e.message), durationMs: Date.now() - start }); }
    save(); console.log(`${checks.at(-1).status.toUpperCase()} ${id}: ${title}`); return checks.at(-1).status;
  }
  function blocked(id, title, reason) { checks.push({ id, title, status: 'blocked', reason }); save(); console.log(`BLOCKED ${id}: ${title}`); }
  async function call(context, method, endpoint, data, options = {}) {
    const response = await context.fetch(endpoint, { method, ...(data === undefined ? {} : { data }), timeout: 30000, ...options });
    let body; try { body = await response.json(); } catch { body = { contentType: response.headers()['content-type'] ?? 'unknown' }; }
    for (const k of ['accessToken', 'token', 'uploadUrl', 'url']) if (body?.[k]) protect(body[k]);
    http.push({ method, endpoint: redact(endpoint), status: response.status(), body: redact(body) }); save();
    return { status: response.status(), body, response };
  }
  async function login(account) {
    const anonymous = await playwright.request.newContext({ baseURL: apiURL });
    try {
      const token = protect(await requestAccessToken((data) => call(anonymous, 'POST', '/auth/login', data), account));
      const api = await playwright.request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
      return { token, api };
    } finally { await anonymous.dispose(); }
  }
  function observe(page) {
    page.on('console', (m) => { if (m.type() === 'error') { consoleEvents.push({ kind: 'console.error', text: redact(m.text()) }); save(); } });
    page.on('pageerror', (e) => { consoleEvents.push({ kind: 'pageerror', text: redact(e.message) }); save(); });
  }
  return { runId, artifactDir, checks, http, check, blocked, call, login, observe, save, summary() { return Object.fromEntries(['passed', 'failed', 'blocked'].map((s) => [s, checks.filter((c) => c.status === s).length])); } };
}
async function clientUploadKey(context, token, folderId) {
  return resolveClientUploadKey({ context, token, folderId, webURL, playwright, protect, channel: 'chrome' });
}
module.exports = { assert, fs, path, qaRoot, appRoot, webURL, apiURL, accounts, playwright, session, protect, redact, pdf, clientUploadKey };
