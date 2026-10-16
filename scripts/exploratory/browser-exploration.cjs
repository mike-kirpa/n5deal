const { assert, path, playwright, session, accounts, webURL, apiURL, redact, protect, pdf } = require('./support.cjs');
(async () => {
  const s = session('browser-exploration');
  const owner = await s.login(accounts[0]), viewer = await s.login(accounts[1]);
  const anon = await playwright.request.newContext({ baseURL: apiURL });
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(10000); s.observe(page);
  const state = { intents: [], completions: [], puts: [], shares: [] };
  let root, rootName, child, uploadKey, file;
  const c = (method, endpoint, data) => s.call(owner.api, method, endpoint, data);
  async function screenshot(name) {
    await page.screenshot({ path: path.join(s.artifactDir, `${name}.png`), mask: [page.locator('input[readonly]'), page.locator('input[type=password]')] });
  }
  page.on('request', (r) => { if (r.method() === 'PUT') { uploadKey = protect(r.headers().apikey); } });
  page.on('response', async (r) => {
    try {
      const url = new URL(r.url());
      if (url.origin === apiURL) {
        const p = url.pathname;
        if (p === '/auth/login' || p === '/files/upload-intent' || p === '/shares') {
          const b = await r.json();
          for (const k of ['accessToken', 'token', 'uploadUrl']) if (b[k]) protect(b[k]);
          if (p === '/files/upload-intent' && b.fileId) state.intents.push({ id: b.fileId, name: b.name });
          if (p === '/shares' && b.id) state.shares.push(b.id);
        }
        if (/\/files\/[^/]+\/complete$/.test(p)) state.completions.push({ endpoint: p, status: r.status() });
        const record = { method: r.request().method(), endpoint: redact(p), status: r.status(), via: 'browser' };
        if (r.request().method() === 'PATCH' && /^\/(files|folders)\//.test(p)) { record.requestBody = r.request().postDataJSON(); record.body = redact(await r.json()); }
        s.http.push(record);
      } else if (r.request().method() === 'PUT') {
        state.puts.push(r.status()); s.http.push({ method: 'PUT', endpoint: '[signed upload URL REDACTED]', status: r.status(), via: 'browser' });
      }
      s.save();
    } catch {}
  });
  async function gotoRoot() {
    await page.goto(`${webURL}/folder/${root}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'New folder', exact: true }).first().waitFor();
  }
  async function loginUI(account) {
    await page.goto(`${webURL}/login`);
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`${webURL}/`);
  }
  async function menu(name, item) {
    await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: item, exact: true }).click();
  }
  try {
    const rooms = await c('GET', '/data-rooms'); assert.equal(rooms.status, 200);
    rootName = `qa-browser-${s.runId}`;
    const created = await c('POST', '/folders', { dataRoomId: rooms.body.items[0].id, name: rootName }); assert.equal(created.status, 201); root = created.body.id;
    await s.check('UI-01', 'Invalid browser login displays error without navigation', async () => {
      await page.goto(`${webURL}/login`); await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
      await page.getByLabel('Password', { exact: true }).fill('qa-invalid-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByText('Invalid email or password', { exact: true }).waitFor(); assert(page.url().endsWith('/login'));
    });
    await s.check('UI-02', 'Valid browser login and own isolated folder', async () => { await loginUI(accounts[0]); await gotoRoot(); });
    await s.check('UI-03', 'Blank folder name form validation', async () => {
      await page.getByRole('button', { name: 'New folder', exact: true }).first().click();
      const d = page.getByRole('dialog'); await d.getByLabel('Folder name').fill('   '); await d.getByRole('button', { name: 'Create', exact: true }).click();
      await d.getByText('Enter a folder name', { exact: true }).waitFor(); await d.getByRole('button', { name: 'Cancel', exact: true }).click();
    });
    await s.check('UI-04', 'Create nested folder through browser', async () => {
      await page.getByRole('button', { name: 'New folder', exact: true }).first().click();
      const d = page.getByRole('dialog'); await d.getByLabel('Folder name').fill('UI child'); await d.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByRole('cell', { name: 'UI child', exact: true }).waitFor();
      child = (await c('GET', `/folders/${root}/contents`)).body.items.find((x) => x.name === 'UI child').id;
    });
    await s.check('UI-05', 'Rename folder through row action', async () => {
      await menu('UI child', 'Rename'); const d = page.getByRole('dialog');
      await d.getByLabel('Folder name').fill('UI renamed'); await d.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('cell', { name: 'UI renamed', exact: true }).waitFor();
    });
    await s.check('UI-06', 'Duplicate folder displays conflict', async () => {
      await page.getByRole('button', { name: 'New folder', exact: true }).first().click();
      const d = page.getByRole('dialog'); await d.getByLabel('Folder name').fill('ui RENAMED'); await d.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByText(/A folder named .* already exists here/).waitFor(); await d.getByRole('button', { name: 'Cancel', exact: true }).click();
    });
    await s.check('UI-07', 'Nested navigation, breadcrumbs, deep-link refresh and session persistence', async () => {
      await page.getByRole('cell', { name: 'UI renamed', exact: true }).click(); await page.waitForURL(`${webURL}/folder/${child}`);
      await page.reload(); await page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('UI renamed', { exact: true }).waitFor();
      await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: rootName, exact: true }).click();
      await page.waitForURL(`${webURL}/folder/${root}`);
    });
    await s.check('UI-08', 'Folder rows offer a keyboard-focusable open action', async () => {
      const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'UI renamed', exact: true }) });
      const semantics = await row.evaluate((el) => ({ tag: el.tagName, tabIndex: el.tabIndex, role: el.getAttribute('role'), links: [...el.querySelectorAll('a')].map((a) => a.textContent) }));
      await screenshot('folder-row-keyboard-navigation');
      assert(semantics.tabIndex >= 0 || semantics.links.length > 0, `No keyboard open target: ${JSON.stringify(semantics)}`);
    });
    await s.check('UI-09', 'Unsupported upload type displays validation error', async () => {
      await page.locator('input[type=file]').setInputFiles({ name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('QA synthetic text') });
      await page.getByText('unsupported.txt is not a PDF', { exact: true }).waitFor();
    });
    await s.check('UI-10', 'Multiple valid PDFs finish upload and appear in listing', async () => {
      await page.locator('input[type=file]').setInputFiles([
        { name: 'browser-one.pdf', mimeType: 'application/pdf', buffer: pdf('Browser PDF one') },
        { name: 'browser-two.pdf', mimeType: 'application/pdf', buffer: pdf('Browser PDF two') },
      ]);
      await page.getByText('Uploads complete', { exact: true }).waitFor({ timeout: 30000 });
      await page.getByRole('cell', { name: 'browser-one.pdf', exact: true }).waitFor();
      await page.getByRole('cell', { name: 'browser-two.pdf', exact: true }).waitFor();
      file = (await c('GET', `/folders/${root}/contents`)).body.items.find((x) => x.name === 'browser-one.pdf');
      return { storagePUTs: state.puts, completionResponses: state.completions, publicUploadKeyObserved: Boolean(uploadKey) };
    });
    if (!file) {
      await screenshot('valid-pdf-upload-failure');
      const panelError = await page.getByText('Some uploads failed', { exact: true }).count();
      s.http.push({ observation: 'Upload panel after valid PDF attempt', errorPanelVisible: Boolean(panelError), puts: state.puts, completions: state.completions, publicUploadKeyObserved: Boolean(uploadKey) }); s.save();
      await s.check('UI-11', 'Retry failed normal upload recovers without creating another intent', async () => {
        const before = state.intents.length;
        const retry = page.getByRole('button', { name: 'Retry upload of browser-one.pdf', exact: true });
        await retry.click(); await page.getByText('Uploads complete', { exact: true }).waitFor({ timeout: 20000 });
        assert.equal(state.intents.length, before);
      });
      await screenshot('valid-pdf-upload-retry-failure');
      for (const [id, title] of [['UI-12','PDF viewer and download'],['UI-13','Rename and move uploaded PDF through browser'],['UI-14','Injected completion failure recovery']]) s.blocked(id, title, 'Normal valid PDF upload did not complete; later file-specific UI assertions unavailable');
    } else {
      await s.check('UI-11', 'Download completed PDF preserves filename', async () => {
        const downloadEvent = page.waitForEvent('download'); await menu('browser-one.pdf', 'Download');
        const download = await downloadEvent; assert.equal(download.suggestedFilename(), 'browser-one.pdf');
      });
      await s.check('UI-12', 'PDF viewer opens and closes to source folder', async () => {
        await page.getByRole('cell', { name: 'browser-one.pdf', exact: true }).click();
        await page.locator('object[type="application/pdf"]').waitFor(); assert(await page.locator('object').getAttribute('data'));
        await screenshot('pdf-viewer'); await page.getByRole('link', { name: 'Close', exact: true }).click(); await page.waitForURL(`${webURL}/folder/${root}`);
      });
      await s.check('UI-13', 'Rename and move uploaded PDF through browser', async () => {
        await menu('browser-one.pdf', 'Rename'); let d = page.getByRole('dialog');
        await d.getByLabel('File name', { exact: true }).fill('browser-renamed');
        await d.getByRole('button', { name: 'Save', exact: true }).click();
        await page.getByRole('cell', { name: 'browser-renamed.pdf', exact: true }).waitFor();
        await menu('browser-renamed.pdf', 'Move'); d = page.getByRole('dialog');
        await d.getByRole('button', { name: `Expand ${rootName}`, exact: true }).click();
        await d.getByRole('button', { name: 'UI renamed', exact: true }).click();
        await d.getByRole('button', { name: 'Move', exact: true }).click();
        await d.waitFor({ state: 'hidden' });
        await page.getByRole('cell', { name: 'browser-renamed.pdf', exact: true }).waitFor({ state: 'hidden' });
        const listing = await c('GET', `/folders/${child}/contents`);
        assert(listing.body.items.some((x) => x.id === file.id && x.name === 'browser-renamed.pdf'));
      });
      await s.check('UI-14', 'Retry recovers after client-simulated completion failure', async () => {
        let injected = false;
        const scope = '**/files/*/complete';
        await page.route(scope, (route) => {
          if (!injected) { injected = true; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA client-simulated completion outage' }) }); }
          return route.continue();
        });
        try {
          await page.locator('input[type=file]').setInputFiles({ name: 'retry-recovery.pdf', mimeType: 'application/pdf', buffer: pdf('Retry recovery') });
          await page.getByText('QA client-simulated completion outage', { exact: true }).waitFor();
          const putEvent = page.waitForResponse((r) => r.request().method() === 'PUT');
          await page.getByRole('button', { name: 'Retry upload of retry-recovery.pdf', exact: true }).click();
          const retryPut = await putEvent;
          if (!retryPut.ok()) await page.getByText(`Upload failed with status ${retryPut.status()}`, { exact: true }).waitFor();
          await screenshot('retry-after-completion-failure');
          s.http.push({ observation: 'Retry after successful PUT and client-simulated completion failure', retryPUTStatus: retryPut.status(), injectedCompletionResponses: 1 }); s.save();
          assert(retryPut.ok(), `Retry PUT HTTP ${retryPut.status()} after original successful PUT`);
          await page.getByRole('cell', { name: 'retry-recovery.pdf', exact: true }).waitFor();
        } finally { await page.unroute(scope); }
      });
    }
    await gotoRoot();
    await s.check('UI-15', 'Share folder using browser; Viewer sees read-only descendants', async () => {
      await page.getByRole('button', { name: 'Share', exact: true }).click(); const d = page.getByRole('dialog');
      await d.getByLabel('Email', { exact: true }).fill(accounts[1].email); await d.getByRole('button', { name: 'Share', exact: true }).click();
      await d.getByText(accounts[1].email, { exact: true }).waitFor(); await d.getByRole('button', { name: 'Done', exact: true }).click();
      const vctx = await browser.newContext(); await vctx.addInitScript((t) => localStorage.setItem('dataroom_token', t), viewer.token);
      const vp = await vctx.newPage(); await vp.goto(`${webURL}/shared-with-me/folder/${root}`);
      await vp.getByRole('cell', { name: 'UI renamed', exact: true }).waitFor();
      assert.equal(await vp.getByRole('button', { name: 'New folder', exact: true }).count(), 0);
      assert.equal(await vp.getByRole('button', { name: 'Upload', exact: true }).count(), 0);
      await vp.screenshot({ path: path.join(s.artifactDir, 'viewer-read-only-folder.png') }); await vctx.close();
    });
    await s.check('UI-16', 'Delete preview error does not permit unqualified destructive action', async () => {
      const scope = `**/folders/${child}/delete-preview`;
      await page.route(scope, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'QA client-simulated preview outage' }) }));
      await menu('UI renamed', 'Delete'); const d = page.getByRole('dialog');
      await d.getByText("Could not check what's inside this folder.", { exact: true }).waitFor();
      const enabled = await d.getByRole('button', { name: 'Delete', exact: true }).isEnabled();
      await screenshot('delete-enabled-after-preview-error');
      await d.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.unroute(scope);
      assert.equal(enabled, false, 'Delete stays enabled after failed preview without subtree warning');
    });
    await s.check('UI-17', 'Session account switch clears owner cache', async () => {
      await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.waitForURL(`${webURL}/login`);
      await page.getByLabel('Email', { exact: true }).fill(accounts[1].email); await page.getByLabel('Password', { exact: true }).fill(accounts[1].password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(`${webURL}/`);
      assert.equal(await page.getByText(rootName, { exact: true }).count(), 0);
      await page.goto(`${webURL}/shared-with-me/folder/${root}`); await page.getByRole('cell', { name: 'UI renamed', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'New folder', exact: true }).count(), 0);
    });
    await s.check('UI-18', 'Fresh protected navigation rejects an invalid session token', async () => {
      await page.evaluate(() => localStorage.setItem('dataroom_token', 'qa-invalid-session'));
      await page.reload(); await page.waitForURL(`${webURL}/login`); return { actualExpiry: 'invalid token simulation; no clock/secret manipulation' };
    });
    await s.check('UI-19', 'Public browser navigation works with stale login and revoked link shows error', async () => {
      const link = await c('POST', '/shares', { resourceType: 'FOLDER', resourceId: root, mode: 'PUBLIC_LINK' });
      assert.equal(link.status, 201); protect(link.body.token); state.shares.push(link.body.id);
      const pc = await browser.newContext(); await pc.addInitScript(() => localStorage.setItem('dataroom_token', 'qa-invalid-session'));
      try {
        const pp = await pc.newPage(); await pp.goto(`${webURL}/share/${link.body.token}`);
        await pp.getByRole('cell', { name: 'UI renamed', exact: true }).waitFor(); assert(new URL(pp.url()).pathname.startsWith('/share/'));
        await pp.getByRole('cell', { name: 'UI renamed', exact: true }).click();
        await pp.getByRole('link', { name: `Back to ${rootName}`, exact: true }).waitFor();
        await pp.screenshot({ path: path.join(s.artifactDir, 'public-nested-folder.png') });
        assert.equal((await c('DELETE', `/shares/${link.body.id}`)).status, 204);
        await pp.reload(); await pp.getByText(/revoked/i).first().waitFor();
        await pp.screenshot({ path: path.join(s.artifactDir, 'public-link-revoked.png') });
      } finally { await pc.close(); }
    });
    await s.check('UI-20', 'Record cached Viewer display after revocation; fresh requests denied', async () => {
      const vc = await browser.newContext(); await vc.addInitScript((t) => localStorage.setItem('dataroom_token', t), viewer.token);
      try {
        const vp = await vc.newPage(); await vp.goto(`${webURL}/shared-with-me/folder/${root}`);
        await vp.getByRole('cell', { name: 'UI renamed', exact: true }).waitFor();
        const grants = await c('GET', `/shares?resourceType=FOLDER&resourceId=${root}&mode=USER`);
        for (const grant of grants.body.items) assert.equal((await c('DELETE', `/shares/${grant.id}`)).status, 204);
        const fresh = await s.call(viewer.api, 'GET', `/folders/${root}/contents`); assert.equal(fresh.status, 404);
        const cachedRowVisible = await vp.getByRole('cell', { name: 'UI renamed', exact: true }).isVisible();
        await vp.screenshot({ path: path.join(s.artifactDir, 'viewer-cache-after-revocation.png') });
        await vp.reload(); await vp.getByText(/Folder not found/i).first().waitFor();
        return { freshHTTPStatus: fresh.status, cachedRowVisibleBeforeReload: cachedRowVisible, afterReload: 'Folder not found', interpretation: 'Product refresh-policy gap; not a fresh authorization bypass' };
      } finally { await vc.close(); }
    });
    await s.check('UI-21', 'Delete nested folder with successful preview via browser', async () => {
      const oc = await browser.newContext(); await oc.addInitScript((t) => localStorage.setItem('dataroom_token', t), owner.token);
      try {
        const op = await oc.newPage();
        const target = await c('POST', '/folders', { dataRoomId: rooms.body.items[0].id, parentId: root, name: 'Delete parent' }); assert.equal(target.status, 201);
        assert.equal((await c('POST', '/folders', { dataRoomId: rooms.body.items[0].id, parentId: target.body.id, name: 'Delete nested' })).status, 201);
        await op.goto(`${webURL}/folder/${root}`); await op.getByRole('button', { name: 'Actions for Delete parent', exact: true }).click();
        await op.getByRole('menuitem', { name: 'Delete', exact: true }).click(); const d = op.getByRole('dialog');
        await d.getByText(/permanently delete 1 subfolder/).waitFor();
        const done = op.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/folders/${target.body.id}`));
        await d.getByRole('button', { name: 'Delete', exact: true }).click(); assert.equal((await done).status(), 204);
        assert.equal((await c('GET', `/folders/${target.body.id}/contents`)).status, 404);
      } finally { await oc.close(); }
    });
  } finally {
    await s.check('UI-CLEANUP', 'Browser assessment shares and folders cleaned up', async () => {
      for (const id of [...new Set(state.shares)]) { const r = await c('DELETE', `/shares/${id}`); assert([204,404].includes(r.status)); }
      if (root) { assert.equal((await c('DELETE', `/folders/${root}`)).status, 204); assert.equal((await c('GET', `/folders/${root}/contents`)).status, 404); }
      return { pendingOrUploadedIntentIdsTracked: state.intents.length, rootDeleted: Boolean(root) };
    });
    await context.close(); await browser.close(); await owner.api.dispose(); await viewer.api.dispose(); await anon.dispose();
    s.save(); console.log(JSON.stringify({ runId: s.runId, ...s.summary() }));
  }
})().catch((e) => { console.error(redact(e.message)); process.exitCode = 1; });
