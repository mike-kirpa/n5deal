import { request } from '@playwright/test';
import { test, expect } from '../../fixtures/qa';
import { Api } from '../../helpers/api';
import { environment } from '../../helpers/environment';

test('both documented accounts authenticate and resolve their own identity', async ({ apis }) => {
  for (const [api, account] of [[apis.owner, environment.owner], [apis.viewer, environment.viewer]] as const) {
    const result = await api.send<{ email: string; id: string; passwordHash?: unknown }>('GET', '/auth/me');
    expect(result.status).toBe(200);
    expect(result.body.email).toBe(account.email);
    expect(result.body.id).toBeTruthy();
    expect(result.body).not.toHaveProperty('passwordHash');
  }
});

test('invalid credentials return an actionable 401', async ({ apis }) => {
  const result = await apis.anonymous.send<{ message: string }>('POST', '/auth/login', {
    email: environment.owner.email, password: 'qa-intentionally-invalid-password',
  });
  expect(result.status).toBe(401);
  expect(result.body.message).toBe('Invalid email or password');
});

test('missing and invalid tokens cannot access protected assessment resources', async ({ apis, assessment, evidence }) => {
  expect((await apis.anonymous.send('GET', '/auth/me')).status).toBe(401);
  expect((await apis.anonymous.send('GET', `/folders/${assessment.root.id}/contents`)).status).toBe(401);
  const context = await request.newContext({ baseURL: environment.apiURL, extraHTTPHeaders: { Authorization: 'Bearer qa-invalid-session' } });
  try {
    expect((await new Api(context, evidence).send('GET', '/auth/me')).status).toBe(401);
  } finally { await context.dispose(); }
  expect((await apis.viewer.send('GET', `/folders/${assessment.root.id}/contents`)).status).toBe(404);
});
