# N5Deal — Product QA Assessment

[QA report](docs/qa-report.md) · [Prioritized findings](docs/findings.md) · [Test plan](docs/test-plan.md) · [Testing approach](docs/testing-approach.md) · [AI disclosure](docs/ai-usage.md)

Risk-based assessment of the [Virtual Data Room](https://github.com/evo9/virtual-data-room) against its [requirements](https://github.com/evo9/virtual-data-room/blob/main/task.md), using the [deployed application](https://virtual-data-room-ten.vercel.app) and documented accounts. The assignment is complete; application source was not modified.

## Result

**Conditional No-Go for real confidential documents.** Upload recovery (BUG-001) and delete safety (BUG-003) require fixes, mitigation or accountable acceptance. Email-ownership risk H01 requires investigation or Product/Security acceptance; it is **not a confirmed vulnerability**.

Four defects remain open: one High, two Medium, one Low. Start with the [report](docs/qa-report.md); use [findings](docs/findings.md#confirmed-bugs) for steps and evidence.

| Selected evidence | Result |
|---|---|
| Exploratory | 61 passed, 4 failed, 6 blocked |
| Current stable automation | 25 API + 12 browser E2E passed |
| Known-defect regressions | 4 expected-failed; not successful product behavior |
| Separate characterization | 4 probes recorded; not contract-pass coverage |
| QA harness unit tests | 4 passed; not product tests |

Selected automation has no unexpected failures, skips or blocked tests. Executions overlap and are not a sum of unique coverage. The [execution history](docs/automation-execution.md#review-follow-up-and-clean-export-verification) links current JSON and retains earlier baselines.

## Quick Start

Use Node.js 24 and npm:

```sh
npm ci
npx playwright install chromium
```

Copy `.env.example` to `.env`: `Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux. Enter `QA_OWNER_PASSWORD` and `QA_VIEWER_PASSWORD` from the [application README](https://github.com/evo9/virtual-data-room#readme). Leave `QA_BROWSER_CHANNEL=` empty for downloaded Chromium; `chrome` selects installed Chrome. Never commit credentials or supply privileged storage keys.

```sh
npm run test:unit
npm run typecheck
npm test
npm run test:known-bugs
```

API PDF setup also needs a browser unless an ordinary public client upload key is supplied. On restricted PowerShell execution policies, use `npm.cmd` / `npx.cmd`. Standalone execution uses environment configuration, not a sibling source checkout.

## Running Tests

| Command | Purpose |
|---|---|
| `npm run test:api` / `test:e2e` | Stable API / browser tests |
| `npm run test:all` | Stable plus known-defect projects |
| `npm run test:characterization` | Unspecified extension/content-policy observations |
| `npm run test:expiration` | Opt-in expiry check, roughly 5–6 minutes plus setup/cleanup; not yet executed |
| `npm run ci:discover` | Collection only; no live tests |
| `npm run test:report` | Print latest saved Markdown report |
| `npm run audit:artifacts` | Scan saved automation evidence |

Live tests mutate only their assessment-owned subtrees and synthetic files. Keep one worker, zero retries; coordinate runs on the shared deployment. Teardown revokes shares, deletes its own root and verifies metadata absence. Failures require scoped recovery; metadata absence does not prove physical storage deletion.

## Evidence and CI

The API-heavy suite covers authorization, sharing, document integrity and validation; browser tests cover valuable journeys and error feedback. Security checks are focused, not a penetration test. H01, whole-room sharing, storage ceilings, races, cross-browser/accessibility and physical cleanup remain limited or unverified; see [coverage gaps](docs/qa-report.md#7-residual-risks-and-coverage-gaps).

Supporting records: [technical discovery](docs/technical-discovery.md), [exploratory execution](docs/exploratory-report.md), [automation history](docs/automation-execution.md), [CI record](docs/ci-execution.md). Historical evidence is preserved.

The [workflow](.github/workflows/qa.yml) runs static validation on push/PR; live tests require manual default-branch dispatch and repository secrets `QA_OWNER_PASSWORD` / `QA_VIEWER_PASSWORD`. Only audited current reports are uploaded. Remote CI/Linux execution is not verified.

AI substantially assisted analysis, test design/execution, implementation and documentation. Results were assessed against executed checks and saved evidence, not independently human-verified in every case. See [AI Usage](docs/ai-usage.md).
