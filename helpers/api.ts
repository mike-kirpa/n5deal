import type { APIRequestContext } from '@playwright/test';
import { createRedactor } from './shared.cjs';
import { environment } from './environment';

export const privacy = createRedactor([
  environment.owner.password, environment.viewer.password, process.env.QA_STORAGE_UPLOAD_KEY || '',
].filter(Boolean));
export const cleanMessage = (error: unknown) => String(privacy.redact(error instanceof Error ? error.message : String(error)));

export class Evidence {
  readonly events: unknown[] = [];
  cleanup: { status: 'passed' | 'failed'; errors: string[]; root?: string; filesVerifiedAbsent?: number } | undefined;
  record(event: unknown) { this.events.push(privacy.redact(event)); }
}

export type Folder = { id: string; name: string; parentId: string | null; dataRoomId: string };
export type Document = { id: string; name: string; folderId: string | null; dataRoomId: string; size: number; mimeType: string };
export type Item = { id: string; name: string; type: 'folder' | 'file'; size?: number };
export type PageOf<T> = { items: T[]; nextCursor: string | null };
export type Share = { id: string; resourceType: 'FOLDER' | 'FILE'; resourceId: string; mode: 'USER' | 'PUBLIC_LINK'; token: string | null };
export type Intent = { fileId: string; name: string; uploadUrl: string };

function protectResponse(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  for (const [key, value] of Object.entries(body)) {
    if (['accessToken', 'token', 'uploadUrl', 'url'].includes(key) && typeof value === 'string') privacy.protect(value);
    else if (value && typeof value === 'object') protectResponse(value);
  }
}

export class Api {
  constructor(readonly context: APIRequestContext, private readonly evidence: Evidence) {}

  async send<T = Record<string, unknown>>(method: string, endpoint: string, data?: unknown): Promise<{ status: number; body: T }> {
    if (!endpoint.startsWith('/')) throw new Error('AutomationError: API endpoints must be relative paths');
    try {
      const response = await this.context.fetch(endpoint, { method, ...(data === undefined ? {} : { data }), timeout: 20_000 });
      const body: unknown = response.status() === 204 ? null : await response.json();
      protectResponse(body);
      // Request bodies/headers are deliberately omitted, including login credentials.
      this.evidence.record({ method, endpoint, status: response.status(), body });
      return { status: response.status(), body: body as T };
    } catch (error) {
      throw new Error(`TransportError: ${cleanMessage(error)}`);
    }
  }

  async upload(url: string, key: string, name: string, bytes: Buffer): Promise<number> {
    privacy.protect(url); privacy.protect(key);
    try {
      const response = await this.context.put(url, {
        headers: { apikey: key, 'x-upsert': 'false' }, timeout: 20_000,
        multipart: { cacheControl: '3600', '': { name, mimeType: 'application/pdf', buffer: bytes } },
      });
      this.evidence.record({ method: 'PUT', endpoint: '[signed upload URL omitted]', status: response.status(), byteCount: bytes.length });
      return response.status();
    } catch (error) { throw new Error(`TransportError: ${cleanMessage(error)}`); }
  }

  async download(url: string, fresh = false) {
    privacy.protect(url);
    try {
      const response = await this.context.get(url, { timeout: 20_000,
        ...(fresh ? { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } } : {}) });
      this.evidence.record({ method: 'GET', endpoint: '[signed content URL omitted]', status: response.status() });
      return { status: response.status(), bytes: await response.body(), disposition: response.headers()['content-disposition'] || '' };
    } catch (error) { throw new Error(`TransportError: ${cleanMessage(error)}`); }
  }
}

export function requireStatus<T>(result: { status: number; body: T }, expected: number): T {
  if (result.status !== expected) throw new Error(`APIContractError: expected HTTP ${expected}; received ${result.status}`);
  return result.body;
}
