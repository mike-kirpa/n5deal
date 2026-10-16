import type { APIRequestContext } from '@playwright/test';
export type Account = { email: string; password: string };
export function readAssessmentReadme(file: string): { webURL: string; apiURL: string; accounts: Account[] };
export function requestAccessToken(send: (account: Account) => Promise<{ status: number; body: { accessToken?: unknown } }>, account: Account): Promise<string>;
export function createRedactor(initial?: string[]): { protect<T extends string | undefined>(value: T): T; redact(value: unknown): unknown };
export function pdf(text?: string): Buffer;
export function resolveClientUploadKey(options: {
  context: APIRequestContext; token?: string; folderId?: string; webURL: string;
  playwright: typeof import('@playwright/test'); protect?: (value: string | undefined) => string | undefined; channel?: string;
  onIntent?: (id: string) => void;
}): Promise<string>;
