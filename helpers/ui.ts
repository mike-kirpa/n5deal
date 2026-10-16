import { chromium, expect } from '@playwright/test';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { environment } from './environment';
import { cleanMessage, privacy } from './api';
import { pdf } from './shared.cjs';
import type { Assessment } from './assessment';

export class UserInterface {
  private browser!: Browser;
  private readonly contexts: BrowserContext[] = [];
  constructor(readonly scope: Assessment) {}
  async start(headless = true) {
    try { this.browser = await chromium.launch({ channel: environment.channel, headless }); }
    catch (error) { throw new Error(`EnvironmentError: Chromium launch failed: ${cleanMessage(error)}`); }
  }
  async page(token?: string) {
    const context = await this.browser.newContext({ viewport: { width: 1365, height: 900 }, acceptDownloads: true,
      ...(token ? { storageState: { cookies: [], origins: [{ origin: environment.webURL, localStorage: [{ name: 'dataroom_token', value: token }] }] } } : {}) });
    this.contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(10_000); this.scope.track(page);
    page.on('pageerror', (error) => this.scope.evidence.record({ browserError: cleanMessage(error) }));
    page.on('console', (message) => { if (message.type() === 'error') this.scope.evidence.record({ consoleError: String(privacy.redact(message.text())) }); });
    return page;
  }
  async login(page: Page, account = environment.owner) {
    try {
      await page.goto(`${environment.webURL}/login`);
      await page.getByLabel('Email', { exact: true }).fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(`${environment.webURL}/`);
    } catch (error) { throw new Error(`BrowserLoginError: ${cleanMessage(error)}`); }
  }
  async openFolder(page: Page, id = this.scope.root.id, shared = false) {
    if (!this.scope.folders.has(id)) throw new Error('AutomationError: browser folder outside assessment');
    await page.goto(`${environment.webURL}${shared ? '/shared-with-me' : ''}/folder/${id}`);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.getByText("Could not load this folder's contents.", { exact: true })).toHaveCount(0);
  }
  async createFolder(page: Page, name: string) {
    await page.getByRole('button', { name: 'New folder', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Folder name').fill(name);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
    await this.scope.flush();
  }
  async upload(page: Page, name: string) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: pdf() });
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible({ timeout: 20_000 });
    await this.scope.flush();
  }
  async menu(page: Page, name: string, item: string) {
    await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole('menuitem', { name: item, exact: true }).click();
  }
  async capture(page: Page, testInfo: TestInfo, name: string) {
    // Never capture login forms, pre-existing room listings or unowned resources.
    const route = new URL(page.url()).pathname;
    const owned = [...this.scope.folders].some((id) => route.endsWith(`/folder/${id}`)) || [...this.scope.files].some((id) => route.endsWith(`/file/${id}`));
    if (!owned) return;
    const body = await page.screenshot({ mask: [page.locator('input[type=password], input[readonly]')] });
    await testInfo.attach(name, { body, contentType: 'image/png' });
  }
  async close() {
    for (const context of this.contexts) await context.close();
    await this.scope.flush();
    if (this.browser) await this.browser.close();
  }
}
