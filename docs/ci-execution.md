# CI implementation and verification

Date: 2026-10-16. Supporting CI implementation history, separate from product execution and the [QA recommendation](qa-report.md). The checks below describe the original CI setup; later framework validation is recorded in [automation history](automation-execution.md).

## Current Status

The workflow is configured, but no remote Actions run URL/result has been verified; Linux execution is not claimed. The read-only remote check returned no branches. Local Windows/Chromium evidence is recorded separately.

The workflow is implemented and locally validated. That is different from a verified remote CI pass. The employer-facing result is the [Final QA Report](qa-report.md); sections below are supporting implementation history.

## Audit and reuse

<details>
<summary>Implementation details and recorded local checks</summary>

Reviewed package/lock, config, environment/API/reporter helpers, fixtures, scope/UI/shared utilities, six spec files, artifact-audit/report/README launchers, gitignore/env example, README and approach/execution docs before modification. Existing framework: API + Chromium + known-api + known-chromium projects; one worker, zero retries; in-memory documented accounts; per-test ID tracking and revoke-before-delete teardown; narrowly placed `test.fail()`; sanitized JSON/Markdown plus controlled attachments.

No second reporter, test framework, Docker, Allure or dependency was added. Changes: one workflow; one dependency-free CJS control script; three npm aliases; current-run filtering/symlink rejection in the existing artifact audit; ignore runtime `.last-run.json`; CI documentation. Linux browser selection already worked through empty `QA_BROWSER_CHANNEL`, native Node paths, generated buffers and Playwright downloads. No compatibility assertion change was necessary. Linux runtime remains subject to actual remote verification below.

## Workflow behavior and safety

- Static job: Ubuntu 24.04 / Node 24 / `npm ci` / typecheck / harness unit tests / discovery. Empty credentials and loopback targets during discovery; no fixtures/live application login; artifact fingerprint must remain unchanged. Runs on push/PR and before manual integration.
- Integration: default-branch `workflow_dispatch` only, two repository password secrets, existing documented hosts/emails (optional repository variables). Existing validator runs before login. Playwright installs Chromium and Linux dependencies. Stable suites then known bugs; unsafe/missing stable teardown prevents further mutations.
- Fixed repository-wide concurrency group, no active-run cancellation; one worker, no retries. Suite global limits 10/5 minutes within a 35-minute job budget. Cross-repository/local overlap and forced termination remain operational limits.
- Step failures are not converted to success. Final summary reads current audited result rows only; missing/partial data, unexpected passes/failures, environment/automation/cleanup failures and skips remain visible and fail validation. Expected-failed bugs are not product passes.
- Audit precedes upload. Only current `report.md` and `results.json`, retention seven days; no HTTP attachments, screenshots, auth-state, raw trace/HAR/video, dependencies or historical data uploaded automatically. Failed audit prevents report parsing/publication. Physical storage cleanup is not claimed.

## Official versions checked

Verified against official release pages/action definitions, pinned to their published commit:

| Action | Version | Commit |
|---|---|---|
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | 7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | 7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | 7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Concurrency semantics were checked in [GitHub documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Permissions are `contents: read`; checkout does not persist credentials; no cache crosses trust boundaries.

## Local non-destructive validation

Executed locally on Windows/Node 24.14.0, not Linux:

- `npm.cmd ci` — passed before and after npm alias changes; lockfile dependency versions unchanged, no new dependencies.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run ci:discover` — collected all 17 cases, none executed; artifact tree unchanged. Credentials were empty and targets loopback, no deployed requests.
- `node --check scripts/ci/control.cjs` and `node --check scripts/audit-artifacts.cjs` — passed.
- `actionlint.exe -shellcheck= -pyflakes= .github/workflows/qa.yml` — passed, actionlint 1.7.12 downloaded to a temporary folder and checked against release SHA-256 sums; YAML/triggers/conditions checked. Shellcheck/Pyflakes were not installed; shell steps are single fixed commands.
- `npm.cmd run audit:artifacts` — existing 34 text artifacts, 3 PNGs requiring visual review, zero findings; no evidence rewritten/deleted.
- Offline in-memory CI-control checks: normal aggregation, unexpected pass, cleanup failure, environment failure, missing report, audit failure/no report parsing, safe/unsafe cleanup gate — all behaved as expected. These are script checks using copies of existing reports in memory, **not new product executions**.
- Preflight with missing passwords exited 1; with dummy non-secret placeholders exited 0 without login. Missing current-prefix artifact audit exited 1. Missing values/unsafe data never printed.

## GitHub configuration / remote execution status

The selected destination is the existing `mike-kirpa/n5deal` repository. The candidate entered the two required repository secrets directly: `QA_OWNER_PASSWORD` and `QA_VIEWER_PASSWORD`. Only their names were verified, not their values. No credentials or session data are included here.

After publication, verify the default-branch workflow and inspect automatic static validation. Review a later manual integration run against its own summary and artifacts; historical local counts are not predictions.

</details>
