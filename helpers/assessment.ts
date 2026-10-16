import { randomUUID } from 'node:crypto';
import * as playwright from '@playwright/test';
import { Api, Evidence, requireStatus, privacy, cleanMessage } from './api';
import type { Folder, Document, Intent, Share, Item, PageOf } from './api';
import { environment } from './environment';
import { pdf, resolveClientUploadKey } from './shared.cjs';

export type Apis = { owner: Api; viewer: Api; anonymous: Api };

/** Tracks only resources created for one test; revoke before recursive deletion. */
export class Assessment {
  root!: Folder;
  roomId!: string;
  readonly folders = new Set<string>();
  readonly files = new Set<string>();
  readonly shares = new Map<string, { type: 'FOLDER' | 'FILE'; resourceId: string; revoked: boolean }>();
  private readonly pending = new Set<Promise<void>>();
  private readonly browserErrors: string[] = [];
  private uploadKey = process.env.QA_STORAGE_UPLOAD_KEY;
  constructor(readonly apis: Apis, readonly evidence: Evidence, private readonly ownerToken: string) {}

  async initialize() {
    const rooms = requireStatus(await this.apis.owner.send<PageOf<{ id: string }>>('GET', '/data-rooms'), 200);
    if (!rooms.items[0]) throw new Error('EnvironmentError: documented owner has no existing room');
    this.roomId = rooms.items[0].id;
    const name = `qa-auto-${process.env.QA_RUN_ID}-${randomUUID().slice(0, 8)}`;
    this.root = requireStatus(await this.apis.owner.send<Folder>('POST', '/folders', { name, dataRoomId: this.roomId }), 201);
    this.folders.add(this.root.id);
  }

  private ownedFolder(id: string) {
    if (!this.folders.has(id)) throw new Error('AutomationError: folder is outside this test assessment');
  }

  async folder(name: string, parentId = this.root.id) {
    this.ownedFolder(parentId);
    const result = await this.apis.owner.send<Folder>('POST', '/folders', { name, dataRoomId: this.roomId, parentId });
    if (result.status === 201 && result.body.id) this.folders.add(result.body.id);
    return requireStatus(result, 201);
  }

  async requestIntent(input: { name: string; size: unknown; mimeType?: unknown }, folderId = this.root.id) {
    this.ownedFolder(folderId);
    const result = await this.apis.owner.send<Intent>('POST', '/files/upload-intent', {
      dataRoomId: this.roomId, folderId, ...input,
    });
    // Track returned IDs before any assertion, including unexpected validation acceptance.
    if (typeof result.body?.fileId === 'string') this.files.add(result.body.fileId);
    return result;
  }

  async intent(name: string, folderId = this.root.id, size = pdf().length) {
    return requireStatus(await this.requestIntent({ name, size, mimeType: 'application/pdf' }, folderId), 201);
  }

  private async clientUploadKey() {
    let key = this.uploadKey;
    if (!key) {
      // Same proven exploratory bootstrap: observe public client header; cancel probe PUT locally.
      key = await resolveClientUploadKey({ context: this.apis.anonymous.context, token: this.ownerToken,
        folderId: this.root.id, webURL: environment.webURL, playwright, protect: privacy.protect, channel: environment.channel,
        onIntent: (id) => this.files.add(id) });
      this.uploadKey = key;
      // Probe intent may be pending: it belongs to our root and is reclaimed with that subtree.
      const probe = requireStatus(await this.apis.owner.send<PageOf<Item>>('GET', `/folders/${this.root.id}/contents`), 200);
      this.evidence.record({ observation: 'client upload header observed; probe PUT cancelled locally', visibleProbeFiles: probe.items.filter((i) => i.name === 'client-key-probe.pdf').length });
    }
    if (!key) throw new Error('EnvironmentError: public client upload header unavailable');
    return key;
  }

  async uploadBytes(intent: Intent, name: string, bytes: Buffer) {
    if (!this.files.has(intent.fileId)) throw new Error('AutomationError: upload outside assessment');
    if (bytes.length > 4096) throw new Error('AutomationError: synthetic upload must not exceed 4 KiB');
    return this.apis.anonymous.upload(intent.uploadUrl, await this.clientUploadKey(), name, bytes);
  }

  async upload(name = 'qa-document.pdf', folderId = this.root.id, bytes = pdf(), declaredSize = bytes.length) {
    await this.clientUploadKey();
    const intent = await this.intent(name, folderId, declaredSize);
    requireStatus({ status: await this.uploadBytes(intent, name, bytes), body: null }, 200);
    return requireStatus(await this.apis.owner.send<Pick<Document, 'id' | 'name' | 'folderId'>>('POST', `/files/${intent.fileId}/complete`), 201);
  }

  async share(type: 'FOLDER' | 'FILE', id: string, mode: 'USER' | 'PUBLIC_LINK' = 'USER') {
    if (!(type === 'FOLDER' ? this.folders : this.files).has(id)) throw new Error('AutomationError: share outside assessment');
    const result = await this.apis.owner.send<Share>('POST', '/shares', {
      resourceType: type, resourceId: id, mode, ...(mode === 'USER' ? { granteeEmail: environment.viewer.email } : {}),
    });
    if (result.status === 201 && result.body.id) this.shares.set(result.body.id, { type, resourceId: id, revoked: false });
    return requireStatus(result, 201);
  }

  async revoke(id: string) {
    const share = this.shares.get(id);
    if (!share) throw new Error('AutomationError: cannot revoke an untracked share');
    requireStatus(await this.apis.owner.send('DELETE', `/shares/${id}`), 204);
    share.revoked = true;
  }

  track(page: playwright.Page) {
    const listener = (response: playwright.Response) => {
      if (new URL(response.url()).origin !== environment.apiURL) return;
      const work = (async () => {
        const request = response.request();
        const endpoint = new URL(response.url()).pathname;
        this.evidence.record({ via: 'browser', method: request.method(), endpoint, status: response.status() });
        if (request.method() !== 'POST' || response.status() !== 201) return;
        const data = request.postDataJSON() as Record<string, unknown>;
        if (endpoint === '/folders' && this.folders.has(String(data.parentId))) {
          const body = await response.json() as Folder; this.folders.add(body.id);
        } else if (endpoint === '/files/upload-intent' && this.folders.has(String(data.folderId))) {
          const body = await response.json() as Intent; privacy.protect(body.uploadUrl); this.files.add(body.fileId);
        } else if (endpoint === '/shares' && (this.folders.has(String(data.resourceId)) || this.files.has(String(data.resourceId)))) {
          const body = await response.json() as Share; privacy.protect(body.token || undefined);
          this.shares.set(body.id, { type: body.resourceType, resourceId: body.resourceId, revoked: false });
        }
      })().catch((error) => { this.browserErrors.push(cleanMessage(error)); });
      this.pending.add(work); void work.finally(() => this.pending.delete(work));
    };
    page.on('response', listener);
    return () => page.off('response', listener);
  }

  async flush() { await Promise.all([...this.pending]); }

  async cleanup() {
    await this.flush();
    const errors: string[] = [...this.browserErrors];
    const recordError = (error: unknown) => errors.push(cleanMessage(error));
    // Discover active grants on known targets too, protecting against delayed UI response handling.
    for (const [type, ids] of [['FOLDER', this.folders], ['FILE', this.files]] as const) {
      for (const id of ids) {
        try {
          let cursor: string | null = null;
          const seen = new Set<string>();
          do {
            const response: { status: number; body: PageOf<Share> } = await this.apis.owner.send('GET', `/shares?resourceType=${type}&resourceId=${id}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
            if (response.status === 404) break; // Metadata can have been deliberately deleted by a test.
            const page = requireStatus(response, 200);
            for (const share of page.items) this.shares.set(share.id, { type, resourceId: id, revoked: false });
            cursor = page.nextCursor;
            if (cursor && seen.has(cursor)) throw new Error('CleanupError: repeated share cursor');
            if (cursor) seen.add(cursor);
          } while (cursor);
        } catch (error) { recordError(error); }
      }
    }
    for (const [id, share] of this.shares) {
      if (!share.revoked) try { await this.revoke(id); } catch (error) { recordError(error); }
    }
    // Keep metadata available for safe follow-up if revocation failed; never hide that failure.
    if (this.root && errors.length === 0) {
      try {
        requireStatus(await this.apis.owner.send('DELETE', `/folders/${this.root.id}`), 204);
        for (const id of this.folders) requireStatus(await this.apis.owner.send('GET', `/folders/${id}/contents`), 404);
        for (const id of this.files) requireStatus(await this.apis.owner.send('GET', `/files/${id}`), 404);
      } catch (error) { recordError(error); }
    }
    this.evidence.cleanup = { status: errors.length ? 'failed' : 'passed', errors, root: this.root?.id, filesVerifiedAbsent: errors.length ? undefined : this.files.size };
    if (errors.length) throw new Error(`CleanupError: ${errors.join('; ')}; assessment root ${this.root?.id || 'not created'}`);
  }
}
