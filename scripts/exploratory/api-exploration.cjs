const { assert, playwright, session, accounts, apiURL, redact, pdf, clientUploadKey, protect } = require('./support.cjs');

(async () => {
  const s = session('api-exploration');
  const anon = await playwright.request.newContext({ baseURL: apiURL });
  const owner = await s.login(accounts[0]), viewer = await s.login(accounts[1]);
  const shares = [], files = [], rootIds = [];
  const data = {}, bytes = pdf();
  let uploadKey;
  const call = (ctx, method, route, body) => s.call(ctx, method, route, body);
  async function status(ctx, method, route, expected, body) {
    const r = await call(ctx, method, route, body); assert.equal(r.status, expected, `${method} ${redact(route)} expected ${expected}, actual ${r.status}`); return r.body;
  }
  async function folder(name, parentId, roomId = data.room) {
    return status(owner.api, 'POST', '/folders', 201, { name, dataRoomId: roomId, ...(parentId ? { parentId } : {}) });
  }
  async function intent(name, folderId, extra = {}) {
    const r = await status(owner.api, 'POST', '/files/upload-intent', 201, { dataRoomId: data.room, folderId, name, size: bytes.length, mimeType: 'application/pdf', ...extra });
    files.push(r.fileId); return r;
  }
  async function upload(name, folderId, content = bytes, metadata = {}) {
    assert(uploadKey, 'Upload key prerequisite');
    const i = await intent(name, folderId, metadata);
    const put = await anon.put(i.uploadUrl, { headers: { apikey: uploadKey, 'x-upsert': 'false' }, multipart: { cacheControl: '3600', '': { name, mimeType: 'application/pdf', buffer: content } } });
    s.http.push({ method: 'PUT', endpoint: '[signed upload URL REDACTED]', status: put.status(), byteCount: content.length }); s.save();
    assert(put.ok(), `Storage PUT HTTP ${put.status()}`);
    const result = await status(owner.api, 'POST', `/files/${i.fileId}/complete`, 201); return { ...result, intent: i };
  }
  async function share(type, id, mode, email) {
    const r = await status(owner.api, 'POST', '/shares', 201, { resourceType: type, resourceId: id, mode, ...(email ? { granteeEmail: email } : {}) });
    shares.push(r.id); if (r.token) protect(r.token); return r;
  }
  try {
    await s.check('API-01', 'Invalid credentials rejected', async () => {
      const r = await call(anon, 'POST', '/auth/login', { email: accounts[0].email, password: 'qa-invalid-password' }); assert.equal(r.status, 401);
    });
    await s.check('API-02', 'Missing and malformed bearer tokens rejected', async () => {
      await status(anon, 'GET', '/auth/me', 401);
      const bad = await playwright.request.newContext({ baseURL: apiURL, extraHTTPHeaders: { Authorization: 'Bearer qa-invalid' } });
      try { await status(bad, 'GET', '/auth/me', 401); } finally { await bad.dispose(); }
    });
    await s.check('API-03', 'Isolated owner and viewer fixtures', async () => {
      data.room = (await status(owner.api, 'GET', '/data-rooms', 200)).items[0].id;
      data.viewerRoom = (await status(viewer.api, 'GET', '/data-rooms', 200)).items[0].id;
      data.viewerRoot = (await status(viewer.api, 'POST', '/folders', 201, { dataRoomId: data.viewerRoom, name: `qa-viewer-${s.runId}` })).id;
      const root = await folder(`qa-api-${s.runId}`); rootIds.push(root.id); data.root = root.id;
      data.a = (await folder('Source', data.root)).id; data.b = (await folder('Destination', data.root)).id;
      data.deep = (await folder('Nested', data.a)).id;
      assert.notEqual(data.room, data.viewerRoom);
    });
    assert(data.root, 'Fixture setup failed');
    await s.check('API-04', 'Unshared room and folder denied to other documented account', async () => {
      await status(viewer.api, 'GET', `/data-rooms/${data.room}`, 404);
      await status(viewer.api, 'GET', `/folders/${data.root}/contents`, 404);
      await status(viewer.api, 'GET', `/folders/${data.root}/breadcrumbs`, 404);
    });
    await s.check('API-05', 'Folder duplicate names case-insensitive; rename and trim', async () => {
      await status(owner.api, 'POST', '/folders', 409, { dataRoomId: data.room, parentId: data.root, name: 'source' });
      const renamed = await status(owner.api, 'PATCH', `/folders/${data.b}`, 200, { name: '  Destination renamed  ' }); assert.equal(renamed.name, 'Destination renamed');
      await status(owner.api, 'PATCH', `/folders/${data.b}`, 409, { name: 'SOURCE' });
    });
    await s.check('API-06', 'Blank folder names rejected without resource creation', async () => {
      await status(owner.api, 'POST', '/folders', 400, { dataRoomId: data.room, parentId: data.root, name: '   ' });
      await status(owner.api, 'PATCH', `/folders/${data.a}`, 400, { name: '   ' });
    });
    await s.check('API-07', 'Foreign-room parent and upload folder rejected', async () => {
      await status(owner.api, 'POST', '/folders', 404, { dataRoomId: data.room, parentId: data.viewerRoot, name: 'must-not-create' });
      await status(owner.api, 'POST', '/files/upload-intent', 404, { dataRoomId: data.room, folderId: data.viewerRoot, name: 'must-not-create.pdf', size: bytes.length, mimeType: 'application/pdf' });
    });
    await s.check('API-08', 'Upload metadata rejects unsupported MIME, zero and over-limit size', async () => {
      for (const values of [{ mimeType: 'text/plain' }, { size: 0 }, { size: 52428801 }]) {
        await status(owner.api, 'POST', '/files/upload-intent', 400, { dataRoomId: data.room, folderId: data.a, name: 'invalid.pdf', size: bytes.length, mimeType: 'application/pdf', ...values });
      }
    });
    await s.check('API-09', 'Pending upload invisible and premature completion rejected', async () => {
      data.pending = await intent('pending.pdf', data.a);
      const listed = await status(owner.api, 'GET', `/folders/${data.a}/contents`, 200);
      assert(!listed.items.some((f) => f.id === data.pending.fileId));
      for (const suffix of ['', '/view-url', '/download-url']) await status(owner.api, 'GET', `/files/${data.pending.fileId}${suffix}`, 404);
      await status(owner.api, 'POST', `/files/${data.pending.fileId}/complete`, 400);
    });
    await s.check('API-10', 'Resolve client upload configuration', async () => { uploadKey = await clientUploadKey(anon, owner.token, data.root); return { resolved: Boolean(uploadKey), keySaved: false, fallback: 'If needed observe normal browser header and cancel only that client PUT; pending row cleaned with QA subtree' }; });
    if (!uploadKey) {
      for (let i = 11; i <= 29; i++) s.blocked(`API-${i}`, 'File/sharing flow prerequisite unavailable', 'Public client upload configuration not resolved; no privileged credentials used');
    } else {
      await s.check('API-11', 'Valid PDF upload, confirm, metadata and bytes', async () => {
        data.file = await upload('report.pdf', data.deep);
        const meta = await status(owner.api, 'GET', `/files/${data.file.id}`, 200); assert.equal(meta.size, bytes.length);
        const view = await status(owner.api, 'GET', `/files/${data.file.id}/view-url`, 200);
        const r = await anon.get(view.url); assert.equal(r.status(), 200); assert.deepEqual(await r.body(), bytes);
        return { byteCount: bytes.length, storedByteCount: meta.size, viewHTTPStatus: r.status() };
      });
      assert(data.file, 'Valid upload prerequisite failed');
      await s.check('API-12', 'Viewer cannot read unshared file metadata or URLs', async () => {
        for (const suffix of ['', '/view-url', '/download-url']) await status(viewer.api, 'GET', `/files/${data.file.id}${suffix}`, 404);
      });
      await s.check('API-13', 'Sequential upload and rename resolve name conflicts', async () => {
        data.second = await upload('REPORT.pdf', data.deep); assert.match(data.second.name, /\(1\)/);
        const rename = await status(owner.api, 'PATCH', `/files/${data.second.id}`, 200, { name: 'report.pdf' }); assert.equal(rename.name, 'report (1).pdf');
      });
      await s.check('API-14', 'Cursor pagination crosses folders and files without omissions', async () => {
        await folder('Another nested', data.a); await upload('root-level.pdf', data.a);
        let cursor, ids = [], pages = 0;
        do {
          const r = await status(owner.api, 'GET', `/folders/${data.a}/contents?limit=1${cursor ? `&cursor=${cursor}` : ''}`, 200);
          ids.push(...r.items.map((x) => x.id)); cursor = r.nextCursor; pages++; assert(pages <= 10);
        } while (cursor);
        assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3); return { pages, returnedItems: ids.length };
      });
      await s.check('API-15', 'Malformed cursor and invalid limit rejected', async () => {
        await status(owner.api, 'GET', `/folders/${data.a}/contents?cursor=bad`, 400);
        await status(owner.api, 'GET', `/folders/${data.a}/contents?limit=101`, 400);
      });
      await s.check('API-16', 'USER folder grant inherits and breadcrumbs hide ancestors', async () => {
        data.userShare = await share('FOLDER', data.a, 'USER', accounts[1].email);
        await status(viewer.api, 'GET', `/folders/${data.deep}/contents`, 200);
        await status(viewer.api, 'GET', `/files/${data.file.id}`, 200);
        const bc = await status(viewer.api, 'GET', `/folders/${data.deep}/breadcrumbs`, 200);
        assert.equal(bc.dataRoomName, null); assert.deepEqual(bc.folders.map((x) => x.id), [data.a, data.deep]);
        await status(viewer.api, 'GET', `/folders/${data.b}/contents`, 404);
        await status(viewer.api, 'GET', `/data-rooms/${data.room}/contents`, 404);
      });
      await s.check('API-17', 'Viewer folder and file mutations rejected', async () => {
        const checks = [
          ['POST','/folders',{ name: 'must-not-create', dataRoomId: data.room, parentId: data.a }],
          ['PATCH',`/folders/${data.a}`,{ name: 'must-not-change' }],
          ['DELETE',`/folders/${data.deep}`], ['GET',`/folders/${data.a}/delete-preview`],
          ['POST','/files/upload-intent',{ name: 'no.pdf', dataRoomId: data.room, folderId: data.a, size: bytes.length, mimeType: 'application/pdf' }],
          ['PATCH',`/files/${data.file.id}`,{ name: 'must-not-change.pdf' }],
          ['PATCH',`/files/${data.file.id}/move`,{ targetFolderId: data.b }],
          ['DELETE',`/files/${data.file.id}`], ['POST',`/files/${data.file.id}/complete`],
        ];
        for (const [m, p, b] of checks) await status(viewer.api, m, p, 404, b);
        return { rejectedOperations: checks.length };
      });
      await s.check('API-18', 'Viewer cannot manage or revoke shares', async () => {
        await status(viewer.api, 'POST', '/shares', 404, { resourceType: 'FOLDER', resourceId: data.a, mode: 'PUBLIC_LINK' });
        await status(viewer.api, 'GET', `/shares?resourceType=FOLDER&resourceId=${data.a}`, 404);
        await status(viewer.api, 'DELETE', `/shares/${data.userShare.id}`, 404);
      });
      await s.check('API-19', 'Sequential repeated USER and public grants reuse active records', async () => {
        const same = await share('FOLDER', data.a, 'USER', accounts[1].email); assert.equal(same.id, data.userShare.id);
        data.publicShare = await share('FOLDER', data.a, 'PUBLIC_LINK');
        const sameLink = await share('FOLDER', data.a, 'PUBLIC_LINK'); assert.equal(sameLink.id, data.publicShare.id);
      });
      await s.check('API-20', 'Anonymous public folder token scoped to subtree', async () => {
        const prefix = `/public/${data.publicShare.token}`;
        await status(anon, 'GET', prefix, 200);
        await status(anon, 'GET', `${prefix}/folders/${data.deep}/contents`, 200);
        await status(anon, 'GET', `${prefix}/files/${data.file.id}`, 200);
        await status(anon, 'GET', `${prefix}/contents`, 404);
        await status(anon, 'GET', `${prefix}/folders/${data.b}/contents`, 404);
        await status(anon, 'GET', '/public/qa-definitely-invalid-token', 404);
      });
      await s.check('API-21', 'Overlapping direct file grant survives parent revocation', async () => {
        data.direct = await share('FILE', data.file.id, 'USER', accounts[1].email);
        await status(owner.api, 'DELETE', `/shares/${data.userShare.id}`, 204);
        await status(viewer.api, 'GET', `/folders/${data.a}/contents`, 404);
        await status(viewer.api, 'GET', `/files/${data.file.id}`, 200);
        await status(owner.api, 'DELETE', `/shares/${data.direct.id}`, 204);
        for (const suffix of ['', '/view-url', '/download-url']) await status(viewer.api, 'GET', `/files/${data.file.id}${suffix}`, 404);
      });
      await s.check('API-22', 'Public revocation rejects every fresh read with 410', async () => {
        await status(owner.api, 'DELETE', `/shares/${data.publicShare.id}`, 204);
        for (const suffix of ['', `/folders/${data.deep}/contents`, `/files/${data.file.id}`, `/files/${data.file.id}/view-url`, `/files/${data.file.id}/download-url`]) await status(anon, 'GET', `/public/${data.publicShare.token}${suffix}`, 410);
      });
      await s.check('API-23', 'Move file; deny old inheritance and preserve direct grant', async () => {
        await status(owner.api, 'PATCH', `/files/${data.file.id}/move`, 404, { targetFolderId: data.viewerRoot });
        const inherited = await share('FOLDER', data.a, 'USER', accounts[1].email);
        const direct = await share('FILE', data.file.id, 'USER', accounts[1].email);
        await status(owner.api, 'DELETE', `/shares/${direct.id}`, 204);
        await status(owner.api, 'PATCH', `/files/${data.file.id}/move`, 200, { targetFolderId: data.b });
        await status(viewer.api, 'GET', `/files/${data.file.id}`, 404);
        data.directMove = await share('FILE', data.file.id, 'USER', accounts[1].email);
        await status(owner.api, 'PATCH', `/files/${data.file.id}/move`, 200, { targetFolderId: data.deep });
        await status(owner.api, 'DELETE', `/shares/${inherited.id}`, 204);
        await status(viewer.api, 'GET', `/files/${data.file.id}`, 200);
      });
      await s.check('API-24', 'Download filename and content preserved after rename', async () => {
        await status(owner.api, 'PATCH', `/files/${data.file.id}`, 200, { name: 'QA renamed document.pdf' });
        const link = await status(owner.api, 'GET', `/files/${data.file.id}/download-url`, 200);
        const response = await anon.get(link.url); assert.equal(response.status(), 200); assert.deepEqual(await response.body(), bytes);
        assert.match(response.headers()['content-disposition'] || '', /QA(?:%20| )renamed(?:%20| )document\.pdf/);
        return { status: response.status(), contentDisposition: response.headers()['content-disposition'], byteCount: bytes.length };
      });
      await s.check('API-25', 'Tiny mismatched upload metadata uses actual stored size', async () => {
        const file = await upload('declared-size-one.pdf', data.b, bytes, { size: 1 });
        const meta = await status(owner.api, 'GET', `/files/${file.id}`, 200); assert.equal(meta.size, bytes.length);
        return { declaredSize: 1, actualSize: meta.size, ceilingValidation: 'not tested' };
      });
      await s.check('API-26', 'Move conflicts and same-folder moves preserve stable file identity', async () => {
        const f = await upload(data.second.name, data.b);
        const r = await status(owner.api, 'PATCH', `/files/${data.second.id}/move`, 200, { targetFolderId: data.b });
        const again = await status(owner.api, 'PATCH', `/files/${data.second.id}/move`, 200, { targetFolderId: data.b });
        assert.equal(r.id, again.id); assert.equal(r.name, again.name); assert.notEqual(r.name.toLowerCase(), f.name.toLowerCase());
      });
      await s.check('API-27', 'Recursive deletion preview matches completed descendant files', async () => {
        const preview = await status(owner.api, 'GET', `/folders/${data.root}/delete-preview`, 200);
        assert.equal(preview.folderCount, 4); assert.equal(preview.fileCount, 5); assert.equal(preview.totalSize, bytes.length * 5);
        return preview;
      });
      await s.check('API-28', 'Single-file deletion rejects subsequent metadata and signed URL requests', async () => {
        data.deleted = await upload('delete-me.pdf', data.b);
        await status(owner.api, 'DELETE', `/files/${data.deleted.id}`, 204);
        for (const suffix of ['', '/view-url', '/download-url']) await status(owner.api, 'GET', `/files/${data.deleted.id}${suffix}`, 404);
      });
      await s.check('API-29', 'Received share list includes only assessment grant IDs being checked', async () => {
        const response = await viewer.api.get('/shares/received'); assert.equal(response.status(), 200);
        const r = await response.json();
        s.http.push({ method: 'GET', endpoint: '/shares/received', status: response.status(), body: { items: r.items.filter((x) => shares.includes(x.shareId)), unrelatedRecordsOmitted: true } }); s.save();
        assert(r.items.some((x) => x.shareId === data.directMove.id));
      });
    }
    s.blocked('H01', 'Email ownership takeover hypothesis', 'Only two existing documented accounts are authorized; an unused owned mailbox/account and account cleanup are unavailable. No account was created.');
    s.blocked('H03-RACE', 'Concurrent duplicate sharing grants', 'Concurrency experiments on shared infrastructure explicitly require additional authorization. Sequential dedup was checked.');
    s.blocked('H04-RACE', 'Concurrent sibling-name collisions', 'No concurrency experiment authorized against shared infrastructure. Sequential conflict behavior was checked.');
    s.blocked('H06-CEILING', 'Actual oversized content and bucket MIME policy', 'No dedicated bucket or configuration observability. Only metadata validation and tiny actual-size reconciliation checked; no oversized storage experiment.');
    s.blocked('H07-INFRA', 'Storage cleanup failure and database rollback consistency', 'No privileged DB/bucket access or storage failure-injection authorization. Metadata cleanup checked externally only.');
    s.blocked('H10-PERSISTENT', 'Whitespace-only registration and data-room API names', 'Creates permanent accounts/rooms with no deletion endpoint; prohibited unnecessary permanent fixtures. Folder equivalents checked.');
  } finally {
    await s.check('API-CLEANUP', 'Revoke created shares and remove all assessment resources', async () => {
      for (const id of [...new Set(shares)]) {
        const r = await call(owner.api, 'DELETE', `/shares/${id}`); assert([204,404].includes(r.status));
      }
      for (const id of rootIds) {
        await status(owner.api, 'DELETE', `/folders/${id}`, 204);
        await status(owner.api, 'GET', `/folders/${id}/contents`, 404);
      }
      if (data.viewerRoot) {
        await status(viewer.api, 'DELETE', `/folders/${data.viewerRoot}`, 204);
        await status(viewer.api, 'GET', `/folders/${data.viewerRoot}/contents`, 404);
      }
      for (const id of files) await status(owner.api, 'GET', `/files/${id}`, 404);
      return { rootsDeleted: rootIds.length, filesAbsent: files.length, uniqueSharesTracked: new Set(shares).size };
    });
    await owner.api.dispose(); await viewer.api.dispose(); await anon.dispose(); s.save();
    console.log(JSON.stringify({ runId: s.runId, ...s.summary() }));
  }
})().catch((e) => { console.error(redact(e.message)); process.exitCode = 1; });
