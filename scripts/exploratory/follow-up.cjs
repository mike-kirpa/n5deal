const { assert, path, playwright, session, accounts, webURL, apiURL, protect, redact, pdf } = require('./support.cjs');
(async () => {
  const s = session('follow-up'), owner = await s.login(accounts[0]);
  const anon = await playwright.request.newContext({ baseURL: apiURL });
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, acceptDownloads: true });
  await context.addInitScript((t) => localStorage.setItem('dataroom_token', t), owner.token);
  const page = await context.newPage(); page.setDefaultTimeout(10000); s.observe(page);
  const shares = []; let root, file;
  const c = (m, p, b) => s.call(owner.api, m, p, b);
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === apiURL) { s.http.push({ method: r.request().method(), endpoint: redact(u.pathname), status: r.status(), via: 'browser' }); s.save(); }
  });
  async function grant(type, id) {
    const r = await c('POST', '/shares', { resourceType: type, resourceId: id, mode: 'PUBLIC_LINK' });
    assert.equal(r.status, 201); protect(r.body.token); shares.push(r.body.id); return r.body;
  }
  try {
    const room = (await c('GET', '/data-rooms')).body.items[0].id;
    const created = await c('POST', '/folders', { dataRoomId: room, name: `qa-follow-up-${s.runId}` }); assert.equal(created.status, 201); root = created.body.id;
    await page.goto(`${webURL}/folder/${root}`);
    await page.locator('input[type=file]').waitFor({ state: 'attached' });
    await s.check('FOLLOW-01', 'Drag-and-drop valid PDF publishes uploaded document', async () => {
      const dt = await page.evaluateHandle((base64) => {
        const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], 'drag-drop.pdf', { type: 'application/pdf' })); return data;
      }, pdf('Drag and drop QA').toString('base64'));
      const drop = page.locator('main > div').first(); await drop.dispatchEvent('dragenter', { dataTransfer: dt });
      await page.getByText('Drop PDF files to upload', { exact: true }).waitFor(); await drop.dispatchEvent('drop', { dataTransfer: dt });
      await page.getByRole('cell', { name: 'drag-drop.pdf', exact: true }).waitFor();
      file = (await c('GET', `/folders/${root}/contents`)).body.items.find((f) => f.name === 'drag-drop.pdf'); assert(file);
      await page.screenshot({ path: path.join(s.artifactDir, 'drag-drop-pdf-published.png') }); await dt.dispose();
    });
    await s.check('FOLLOW-02', 'Zero-byte browser PDF shows API validation error', async () => {
      const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/files/upload-intent' && r.request().method() === 'POST');
      await page.locator('input[type=file]').setInputFiles({ name: 'zero.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
      assert.equal((await response).status(), 400); await page.getByText(/size must not be less than 1/).waitFor();
      await page.screenshot({ path: path.join(s.artifactDir, 'zero-byte-pdf-validation.png') });
    });
    await s.check('FOLLOW-03', 'Single-file public link opens PDF and cannot read sibling file', async () => {
      assert(file, 'Uploaded PDF prerequisite'); const share = await grant('FILE', file.id);
      const pc = await browser.newContext(); const pp = await pc.newPage();
      try {
        await pp.goto(`${webURL}/share/${share.token}`); await pp.locator('object[type="application/pdf"]').waitFor();
        await pp.waitForTimeout(1500); // Allow the native PDF plugin to paint before visual evidence.
        await pp.screenshot({ path: path.join(s.artifactDir, 'single-file-public-preview.png') });
        const r = await s.call(anon, 'GET', `/public/${share.token}/contents`); assert.equal(r.status, 404);
        await page.locator('input[type=file]').setInputFiles({ name: 'sibling.pdf', mimeType: 'application/pdf', buffer: pdf('Unshared sibling') });
        await page.getByRole('cell', { name: 'sibling.pdf', exact: true }).waitFor();
        const sibling = (await c('GET', `/folders/${root}/contents`)).body.items.find((x) => x.name === 'sibling.pdf'); assert(sibling);
        const other = await s.call(anon, 'GET', `/public/${share.token}/files/${sibling.id}`); assert.equal(other.status, 404);
      } finally { await pc.close(); }
    });
    await s.check('FOLLOW-04', 'Session verification 5xx offers retry and recovers', async () => {
      const sc = await browser.newContext(); await sc.addInitScript((t) => localStorage.setItem('dataroom_token', t), owner.token);
      const sp = await sc.newPage();
      try {
        await sp.route('**/auth/me', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA client-simulated session check error' }) }));
        await sp.goto(`${webURL}/folder/${root}`); await sp.getByText('Could not verify your session. Check your connection and try again.', { exact: true }).waitFor();
        assert(!sp.url().endsWith('/login')); await sp.screenshot({ path: path.join(s.artifactDir, 'session-check-error-retry.png') });
        await sp.unroute('**/auth/me'); await sp.getByRole('button', { name: 'Retry', exact: true }).click();
        await sp.getByRole('cell', { name: 'drag-drop.pdf', exact: true }).waitFor();
      } finally { await sc.close(); }
    });
    await s.check('FOLLOW-05', 'Fresh public access revoked while pre-issued URL remains temporarily usable', async () => {
      const share = await grant('FILE', file.id);
      const signed = await s.call(anon, 'GET', `/public/${share.token}/files/${file.id}/view-url`); assert.equal(signed.status, 200);
      const before = await anon.get(signed.body.url); assert.equal(before.status(), 200);
      assert.equal((await c('DELETE', `/shares/${share.id}`)).status, 204);
      assert.equal((await s.call(anon, 'GET', `/public/${share.token}/files/${file.id}/view-url`)).status, 410);
      const after = await anon.get(signed.body.url); assert.equal(after.status(), 200);
      return { beforeRevokeStatus: before.status(), freshURLIssuanceStatus: 410, existingURLStatusImmediatelyAfterRevoke: after.status(), expiryEnforcement: 'not waited for; documented five-minute TTL', classification: 'documented residual risk, not a defect' };
    });
    await s.check('FOLLOW-06', 'Keyboard public Download does not also open file row', async () => {
      const share = await grant('FOLDER', root); const pc = await browser.newContext({ acceptDownloads: true }); const pp = await pc.newPage();
      try {
        await pp.goto(`${webURL}/share/${share.token}`); const button = pp.getByRole('button', { name: 'Download drag-drop.pdf', exact: true }); await button.waitFor();
        const before = pp.url(); await button.focus(); const dl = pp.waitForEvent('download'); await pp.keyboard.press('Enter');
        assert.equal((await dl).suggestedFilename(), 'drag-drop.pdf'); assert.equal(pp.url(), before);
      } finally { await pc.close(); }
    });
  } finally {
    await s.check('FOLLOW-CLEANUP', 'Follow-up shares and all PDF/pending metadata cleaned up', async () => {
      for (const id of [...new Set(shares)]) { const r = await c('DELETE', `/shares/${id}`); assert([204,404].includes(r.status)); }
      if (root) { assert.equal((await c('DELETE', `/folders/${root}`)).status, 204); assert.equal((await c('GET', `/folders/${root}/contents`)).status, 404); }
    });
    await context.close(); await browser.close(); await owner.api.dispose(); await anon.dispose(); s.save(); console.log(JSON.stringify({ runId: s.runId, ...s.summary() }));
  }
})().catch((e) => { console.error(redact(e.message)); process.exitCode = 1; });
