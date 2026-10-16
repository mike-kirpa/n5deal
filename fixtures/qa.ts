import { test as base, expect, request } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { Api, Evidence, privacy, cleanMessage } from '../helpers/api';
import { environment, validateEnvironment } from '../helpers/environment';
import { requestAccessToken } from '../helpers/shared.cjs';
import { Assessment } from '../helpers/assessment';
import type { Apis } from '../helpers/assessment';
import { UserInterface } from '../helpers/ui';

type Actors = { owner: APIRequestContext; viewer: APIRequestContext; anonymous: APIRequestContext; ownerToken: string; viewerToken: string };
type Fixtures = { evidence: Evidence; apis: Apis; assessment: Assessment; ui: UserInterface };

export const test = base.extend<Fixtures, { actors: Actors }>({
  actors: [async ({}, use) => {
    validateEnvironment();
    const contexts: APIRequestContext[] = [];
    async function context(token?: string) {
      const result = await request.newContext({ baseURL: environment.apiURL, extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 20_000 });
      contexts.push(result); return result;
    }
    try {
      const anonymous = await context();
      const temporary = new Api(anonymous, new Evidence());
      const health = await temporary.send<{ status: string }>('GET', '/health');
      if (health.status !== 200 || health.body.status !== 'ok') throw new Error('EnvironmentError: API health unavailable');
      const ownerToken = privacy.protect(await requestAccessToken((data) => temporary.send('POST', '/auth/login', data), environment.owner));
      const viewerToken = privacy.protect(await requestAccessToken((data) => temporary.send('POST', '/auth/login', data), environment.viewer));
      await use({ owner: await context(ownerToken), viewer: await context(viewerToken), anonymous, ownerToken, viewerToken });
    } catch (error) { throw new Error(`EnvironmentError: documented actor setup/lifecycle failed: ${cleanMessage(error)}`); }
    finally { for (const c of contexts) await c.dispose(); }
  }, { scope: 'worker' }],

  evidence: [async ({}, use, testInfo) => {
    const evidence = new Evidence();
    try { await use(evidence); }
    finally {
      await testInfo.attach('sanitized-evidence', {
        body: Buffer.from(JSON.stringify(privacy.redact({ events: evidence.events, cleanup: evidence.cleanup }), null, 2)),
        contentType: 'application/json',
      });
    }
  }, { auto: true }],

  apis: async ({ actors, evidence }, use) => {
    await use({ owner: new Api(actors.owner, evidence), viewer: new Api(actors.viewer, evidence), anonymous: new Api(actors.anonymous, evidence) });
  },
  assessment: async ({ apis, actors, evidence }, use, testInfo) => {
    const scope = new Assessment(apis, evidence, actors.ownerToken);
    try { await scope.initialize(); await use(scope); }
    finally {
      try { await scope.cleanup(); }
      catch (error) { testInfo.annotations.push({ type: 'cleanup-failure', description: cleanMessage(error) }); throw error; }
    }
  },
  ui: async ({ assessment, headless }, use, testInfo) => {
    const ui = new UserInterface(assessment);
    try { await ui.start(headless); await use(ui); }
    finally {
      try { await ui.close(); }
      catch (error) { testInfo.annotations.push({ type: 'automation-failure', description: cleanMessage(error) }); throw error; }
    }
  },
});
export { expect };
