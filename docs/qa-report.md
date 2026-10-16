# N5Deal — Final QA Report

Assessment completed: 2026-10-16. Product evidence: 2026-10-15–16.

## 1. Executive Summary

**Conditional No-Go for real confidential documents.** Core folder, PDF and read-only sharing flows worked in the assessed scope. No authorization bypass or byte corruption was observed. Upload recovery and destructive-action safety nevertheless need resolution or accountable acceptance. Recipient identity risk H01 remains unverified, not a confirmed vulnerability.

A non-sensitive demonstration is reasonable with limitations disclosed. No Product/Security risk acceptance is recorded.

## 2. Scope and Testing Approach

Discovery and exploratory testing informed API-heavy Playwright automation, browser journeys and defect regressions. Scope covered sessions, hierarchy, documents, validation, permissions, public/USER sharing and revocation. Only documented accounts and owned synthetic data were used; application source was unchanged.

Verification used Windows, Node 24 and Playwright 1.56.1-managed Chromium 141 in a clean working-tree export, not a committed checkout/Linux CI. Source/deployment parity is unknown. See [AI Usage](ai-usage.md).

## 3. Test Execution Results

Exploratory assessment: **61 passed, 4 failed, 6 blocked**, from the [four selected runs](exploratory-report.md#final-check-accounting).

| Current selected automation | Result |
|---|---|
| Stable API | 25 passed |
| Stable browser E2E | 12 passed |
| Known-defect regressions | 4 expected-failed |
| Separate characterization | 4 recorded probes, excluded from stable coverage |
| QA harness units | 4 passed; not product checks |

Selected Playwright runs have zero unexpected failures/passes, global errors, skips or blocks. Expected failures reproduce defects; characterization does not prove PDF enforcement.

[Execution history](automation-execution.md#review-follow-up-and-clean-export-verification) links current JSON and preserves the original 10 API / 3 E2E / 4 expected-failed baseline. Executions overlap, not additive unique coverage.

## 4. Key Findings and Business Impact

| Defect | Severity / priority | Business impact |
|---|---|---|
| BUG-001 — Upload retry recovery | High / P1 | Successful storage transfer followed by a completion error leaves Retry unable to publish the file. |
| BUG-002 — Premature completion HTTP 500 | Medium / P2 | An incomplete upload produces a server error rather than actionable client feedback. |
| BUG-003 — Unsafe delete confirmation | Medium / P2 | After preview failure, deletion can be confirmed without the required nested-content warning. |
| BUG-004 — Keyboard folder navigation | Low / P2 | Folder opening lacks a keyboard-operable row/menu target. |

All remain open; [findings](findings.md#confirmed-bugs) has steps/evidence. BUG-001/003 use browser-local simulations, not backend outages; unsafe deletion was cancelled.

## 5. Automated Coverage

API checks cover auth, hierarchy, PDF bytes, naming/moves, pagination, inherited/independent grants, revocation and metadata boundaries. Security negatives reject tampered/unsigned JWTs and missing/tampered/path-swapped storage tokens for owned objects.

Browser checks cover document journeys, sharing, account switching, UI revoke, multiple tabs, literal markup names, deletion during viewing and batch-upload progress/recovery. PDF object visibility proves integration, not complete rendering. Units protect QA redaction/outcome logic, not application logic.

## 6. Release Readiness Assessment

**Confirmed gates:** fix/mitigate BUG-001 recovery and BUG-003 destructive-action safety and retest, or record Product acceptance with controls. BUG-003 remains Medium.

**Investigation risk:** H01. USER grants are associated with normalized emails, while reviewed registration source does not verify mailbox ownership. No approved unused mailbox/disposable account was available, so the scenario was not reproduced. No existing-account password bypass is established. Product/Security must resolve or explicitly accept this uncertainty before confidential use.

**Product decisions:** identity proof, post-revoke caching/URLs, content policy and preview-error fallback. **Non-blocking:** BUG-002/004; an accessibility obligation may raise BUG-004's priority.

## 7. Residual Risks and Coverage Gaps

H01, grant/name races, actual large-object limits, infrastructure/physical cleanup and persistent account/room validation remain unresolved. Whole-Data-Room USER/public sharing requires a dedicated empty room; existing-room sharing could expose baseline data.

Old URLs/cached UI can remain available after revoke while fresh authorization is denied. Expiry remains unexecuted; the corrected opt-in oracle requires a healthy same-file control. Downloaded bytes cannot be recalled.

Tiny non-PDF/corrupted payloads were accepted unchanged, not a fifth defect without a requirement/impact. Small-size reconciliation does not establish the storage ceiling.

Cleanup passed for all 43 resource scopes: revocation/metadata absence, not physical deletion/pending-row purge. Comprehensive security, rate-limit/load, cross-browser/mobile, accessibility and infrastructure audits remain outside scope.

## 8. Recommended Next Steps

1. Fix/mitigate the two release gates and retest known-defect expectations.
2. Investigate H01 with approved disposable identities; test whole-room sharing in an isolated empty room.
3. Agree content/revocation/accessibility policies; execute expiry and controlled infrastructure/race checks in an appropriate environment.
4. Verify a published clean checkout and authorized remote CI; obtain Product/Security release approval.
