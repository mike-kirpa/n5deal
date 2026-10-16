const { assert, path, playwright, session, accounts, webURL, apiURL, redact } = require('./support.cjs');
(async () => {
  const s = session('environment');
  const anon = await playwright.request.newContext({ baseURL: apiURL });
  let browser, auth, isolatedId;
  try {
    await s.check('ENV-01', 'Frontend availability', async () => {
      const r = await anon.get(webURL, { timeout: 30000 }); assert.equal(r.status(), 200); assert.match(await r.text(), /<div id="root"/);
      return { status: r.status(), contentType: r.headers()['content-type'] };
    });
    await s.check('ENV-02', 'Backend health', async () => {
      const r = await s.call(anon, 'GET', '/health'); assert.equal(r.status, 200); assert.equal(r.body.status, 'ok');
    });
    for (let i = 0; i < accounts.length; i++) await s.check(`ENV-0${i + 3}`, `Documented account ${i + 1} authentication`, async () => {
      const identity = await s.login(accounts[i]); const me = await s.call(identity.api, 'GET', '/auth/me');
      assert.equal(me.status, 200); assert.equal(me.body.email, accounts[i].email);
      if (i === 0) auth = identity; else await identity.api.dispose();
    });
    await s.check('ENV-05', 'Chrome automation and login form', async () => {
      browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
      const context = await browser.newContext(); const page = await context.newPage(); s.observe(page);
      const r = await page.goto(`${webURL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      await page.screenshot({ path: path.join(s.artifactDir, 'login-page.png') });
      const version = browser.version(); await context.close(); return { navigationStatus: r.status(), browserVersion: version };
    });
    await s.check('ENV-06', 'Create and clean up assessment-owned folder', async () => {
      assert(auth, 'Owner authentication prerequisite'); const rooms = await s.call(auth.api, 'GET', '/data-rooms');
      assert.equal(rooms.status, 200); assert(rooms.body.items.length > 0);
      const r = await s.call(auth.api, 'POST', '/folders', { dataRoomId: rooms.body.items[0].id, name: `qa-environment-${s.runId}` });
      assert.equal(r.status, 201); isolatedId = r.body.id;
      assert.equal((await s.call(auth.api, 'DELETE', `/folders/${isolatedId}`)).status, 204);
      assert.equal((await s.call(auth.api, 'GET', `/folders/${isolatedId}/contents`)).status, 404); isolatedId = null;
    });
  } finally {
    if (isolatedId && auth) await s.call(auth.api, 'DELETE', `/folders/${isolatedId}`).catch(() => {});
    if (auth) await auth.api.dispose(); await anon.dispose(); if (browser) await browser.close();
    s.save(); console.log(JSON.stringify({ runId: s.runId, ...s.summary() }));
  }
})().catch((e) => { console.error(redact(e.message)); process.exitCode = 1; });
