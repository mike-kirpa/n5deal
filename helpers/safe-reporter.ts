import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter, TestCase, TestResult, FullResult, FullConfig, Suite } from '@playwright/test/reporter';
import { privacy, cleanMessage } from './api';
import { runDirectory } from './environment';
import { classifyResult } from './result-policy.cjs';

type Row = { title: string; project: string; classification: string; status: string; expectedStatus: string;
  durationMs: number; bugs: string[]; errors: string[]; cleanup: string; attachments: { name: string; path?: string }[] };

export default class SafeReporter implements Reporter {
  private readonly rows: Row[] = [];
  private readonly globalErrors: string[] = [];
  private readonly listing = process.argv.includes('--list');
  constructor() {
    // A constructor error aborts reporter loading; hook exceptions can otherwise be swallowed.
    if (!this.listing) mkdirSync(runDirectory, { recursive: true });
  }
  onBegin(_config: FullConfig, suite: Suite) {
    if (this.listing) {
      for (const test of suite.allTests()) console.log(`${test.parent.project()?.name}: ${test.title}`);
      console.log(`Collected ${suite.allTests().length} tests; none executed.`);
    }
  }
  onError(error: { message?: string }) {
    const message = cleanMessage(error.message || 'Unknown runner error');
    this.globalErrors.push(message); console.error(`[runner-error] ${message}`);
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const cleanupFailure = test.annotations.some((a) => a.type === 'cleanup-failure');
    const infrastructureFailure = test.annotations.some((a) => a.type === 'automation-failure') || result.errors.some((e) => e.message?.includes('AutomationError:'));
    const environmentFailure = result.errors.some((e) => e.message?.includes('EnvironmentError:'));
    const classification = classifyResult({ cleanupFailure, infrastructureFailure, environmentFailure, expectedStatus: test.expectedStatus, status: result.status });
    const evidence = result.attachments.find((a) => a.name === 'sanitized-evidence');
    let cleanup = 'not-needed';
    if (evidence?.body || evidence?.path) {
      const text = evidence.body?.toString() || readFileSync(evidence.path!, 'utf8');
      cleanup = (JSON.parse(text) as { cleanup?: { status: string } }).cleanup?.status || cleanup;
    }
    const attachments: Row['attachments'] = [];
    for (const attachment of result.attachments) {
      if (!attachment.body && !attachment.path) continue;
      if (attachment.name !== 'sanitized-evidence' && !/^BUG-00[1-4]-[a-z-]+$/.test(attachment.name)) continue;
      try {
        const directory = join(runDirectory, 'attachments');
        mkdirSync(directory, { recursive: true });
        const extension = attachment.contentType === 'image/png' ? 'png' : 'json';
        const target = join(directory, `${this.rows.length + 1}-${attachment.name}.${extension}`);
        const body = attachment.body || readFileSync(attachment.path!);
        writeFileSync(target, extension === 'json' ? String(privacy.redact(body.toString('utf8'))) : body);
        attachments.push({ name: attachment.name, path: target });
      } catch { this.globalErrors.push('EnvironmentError: sanitized attachment could not be written'); }
    }
    const row: Row = {
      title: String(privacy.redact(test.title)), project: test.parent.project()?.name || '', classification,
      status: result.status, expectedStatus: test.expectedStatus, durationMs: result.duration,
      bugs: test.annotations.filter((a) => a.type === 'bug').map((a) => a.description || ''),
      errors: result.errors.map((e) => cleanMessage(e.message || 'Unknown test error')),
      cleanup: cleanupFailure ? 'failed' : cleanup,
      attachments,
    };
    this.rows.push(row);
    console.log(`[${classification}] ${row.project}: ${row.title}`);
  }
  async onEnd(result: FullResult) {
    if (this.listing) return;
    const counts: Record<string, number> = {};
    for (const row of this.rows) counts[row.classification] = (counts[row.classification] || 0) + 1;
    const unsafe = this.globalErrors.length || this.rows.some((r) => ['cleanup-failure', 'automation-failure', 'environment-failure', 'unexpected-failure', 'unexpected-pass'].includes(r.classification));
    const report = privacy.redact({ runId: process.env.QA_RUN_ID, endedAt: new Date().toISOString(), runnerStatus: result.status,
      effectiveStatus: unsafe ? 'failed' : result.status, counts, globalErrors: this.globalErrors, tests: this.rows });
    const markdown = `# Automation execution — ${process.env.QA_RUN_ID}\n\n` +
      `Runner: ${result.status}. Effective: ${unsafe ? 'failed' : result.status}.\n\n` +
      `Counts: ${JSON.stringify(counts)}\n\nExpected failures are known defects, not ordinary passes. Unexpected passes require review.\n\n` +
      '| Project | Test | Result | Cleanup |\n|---|---|---|---|\n' +
      this.rows.map((r) => `| ${r.project} | ${r.title.replace(/\|/g, '\\|')} | ${r.classification} | ${r.cleanup} |`).join('\n') + '\n';
    try {
      writeFileSync(join(runDirectory, 'results.json'), JSON.stringify(report, null, 2));
      writeFileSync(join(runDirectory, 'report.md'), String(privacy.redact(markdown)));
    } catch {
      console.error('EnvironmentError: sanitized report could not be written');
      process.exitCode = 1;
      return { status: 'failed' as const };
    }
    console.log(`Counts: ${JSON.stringify(counts)}. Effective status: ${unsafe ? 'failed' : result.status}; global errors: ${this.globalErrors.length}. Sanitized report: ${join(runDirectory, 'report.md')}`);
    if (unsafe) return { status: 'failed' as const };
  }
}
