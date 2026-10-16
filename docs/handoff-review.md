# Handoff Checklist

Supporting packaging checklist; the employer-facing entry point is [README](../README.md), followed by the [QA report](qa-report.md) and [findings](findings.md).

## Include

QA tests, fixtures/helpers, maintenance scripts, Playwright/TypeScript configuration, package lockfile, workflow, blank-password environment template, required reports and sanitized historical evidence. Retain earlier failed/superseded runs with their selection context; they explain test-development corrections.

## Exclude

Dependency installs, actual credentials, privileged storage keys, auth-state/browser profiles, raw traces/HAR/video/DOM dumps, generated runtime pointers and unrelated temporary files. Do not include the sibling application or its credential-bearing README. Do not delete the repository's actual Git directory.

## Submission Checks

- Required deliverables and AI disclosure are linked from README.
- Selected result counts must match their JSON, with expected failures and characterization separate.
- Review all final staged contents and screenshots for sensitive material; pattern scans are not a guarantee.
- Confirm ignored files are absent from the submission and local documentation links resolve.
- Verify reviewer access and repository navigation after publication.
- Treat [CI configuration](ci-execution.md) separately from remote execution evidence.

The clean-export verification and final artifact audit are recorded in [automation history](automation-execution.md). A working-tree export is not a committed-checkout test. Review the final staged snapshot before publication; no first commit or remote CI pass is evidenced.

Product release gates are not missing assignment deliverables: BUG-001/003 and unresolved identity uncertainty still require fixes, controls or accountable acceptance before real confidential-document use.
