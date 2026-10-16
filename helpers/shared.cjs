const assert = require('node:assert/strict');

function readAssessmentReadme(file) {
  const text = require('node:fs').readFileSync(file, 'utf8');
  const webURL = text.match(/Web:\s*(https:\/\/\S+)/)[1];
  const apiURL = text.match(/API:\s*(https:\/\/[^\s(]+)/)[1];
  const accounts = [...text.matchAll(/^\|\s*([^|\s]+@[^|\s]+)\s*\|\s*([^|]+?)\s*\|/gm)].map((m) => ({ email: m[1], password: m[2].trim() }));
  assert.equal(accounts.length, 2, 'Two documented test accounts expected');
  return { webURL, apiURL, accounts };
}
async function requestAccessToken(send, account) {
  const response = await send(account);
  assert.equal(response.status, 200, 'Authentication HTTP status');
  assert.equal(typeof response.body.accessToken, 'string', 'Authentication token missing');
  return response.body.accessToken;
}

function createRedactor(initial = []) {
const secrets = new Set(initial);
function protect(v) { if (typeof v === 'string' && v) secrets.add(v); return v; }
function redact(v) {
  if (typeof v === 'string') {
    for (const secret of secrets) v = v.split(secret).join('[REDACTED]');
    return v.replace(/https?:\/\/[^\s"'<>]+/g, '[URL REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT REDACTED]');
  }
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^(password|accessToken|authorization|token|uploadUrl|url|apikey|cookie)$/i.test(k) ? '[REDACTED]' : redact(x)]));
  return v;
}
  return { protect, redact };
}

function pdf(text = 'N5Deal QA synthetic PDF') {
  const content = `BT /F1 16 Tf 40 100 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let output = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}

async function resolveClientUploadKey({ context, token, folderId, webURL, playwright, protect = (v) => v, channel, onIntent }) {
  const html = await (await context.get(webURL)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of scripts) {
    const body = await (await context.get(new URL(src, webURL).href)).text();
    const match = body.match(/setRequestHeader\(["']apikey["'],\s*["']([^"']+)["']\)/);
    if (match) return protect(match[1]);
  }
  if (token && folderId) {
    const browser = await playwright.chromium.launch({ channel, headless: true });
    try {
      const bc = await browser.newContext(); await bc.addInitScript((t) => localStorage.setItem('dataroom_token', t), token);
      const page = await bc.newPage();
      let intentWork = Promise.resolve();
      if (onIntent) page.on('response', (response) => {
        if (new URL(response.url()).pathname === '/files/upload-intent' && response.status() === 201) {
          intentWork = response.json().then((body) => { protect(body.uploadUrl); onIntent(body.fileId); });
        }
      });
      let resolveKey; const key = new Promise((resolve) => { resolveKey = resolve; });
      await page.route('**/*', async (route) => {
        if (route.request().method() === 'PUT') {
          resolveKey(protect(route.request().headers().apikey));
          await route.fulfill({ status: 503, body: 'QA client-only upload cancellation' });
        } else await route.continue();
      });
      await page.goto(`${webURL}/folder/${folderId}`);
      await page.locator('input[type=file]').setInputFiles({ name: 'client-key-probe.pdf', mimeType: 'application/pdf', buffer: pdf() });
      let timeout;
      try {
        const observed = await Promise.race([key, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('No upload request observed')), 15000); })]);
        await intentWork;
        return observed;
      }
      finally { clearTimeout(timeout); }
    } finally { await browser.close(); }
  }
  const e = new Error('Client upload configuration unavailable'); e.blocked = true; throw e;
}

module.exports = { readAssessmentReadme, requestAccessToken, createRedactor, pdf, resolveClientUploadKey };
