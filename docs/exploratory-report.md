# Exploratory Test Execution Report

## 1. Environment and execution details

Execution date: **2026-10-15**, approximately **21:15–21:56 Europe/Warsaw (CEST)** / **19:15–19:56 UTC**. Artifact run names use UTC. Preparation and script-debugging time is separate from individual recorded scenario durations.

| Item | Actual environment |
|---|---|
| Frontend | `https://virtual-data-room-ten.vercel.app` — HTTP 200 and rendered login form |
| API | `https://virtual-data-room-production.up.railway.app` — `/health` HTTP 200 `{status:'ok'}` |
| Accounts | Only documented `john@example.com` and `viewer@example.com`; authentication and `/auth/me` verified |
| Automation | Playwright 1.56.1, Node v24.14.0, npm 11.9.0, Windows PowerShell |
| Browser | Installed Google Chrome 155.0.8059.79, headless; primary viewport 1365×900 |
| Local source | Read-only `virtual-data-room`, HEAD `4a787b43bd921be48f5ab11e30828b97b8c5ee0c`; deployment parity unknown |
| Data | Unique `qa-environment-*`, `qa-api-*`, `qa-viewer-*`, `qa-browser-*`, `qa-follow-up-*` folders; small generated PDFs/text/empty file; no new accounts or rooms |
| Evidence | Sanitized execution JSON, HTTP status/payload records, browser console/page errors and selected screenshots under `artifacts/` |

The four requested inputs were read: application `task.md`, `README.md`, existing QA `test-plan.md` and `technical-discovery.md`. Existing plan/discovery/approach/AI/final-report documents were preserved. `findings.md` was populated as the expressly requested findings output, retaining its existing heading/introduction. No application code was changed or fixed.

Playwright was made available through npm's temporary/cache runtime; neither repository's package files were changed. Initial npm-cache and artifact-directory writes were blocked by sandbox permissions and succeeded after approved execution outside the sandbox. These were resolved tool-environment constraints, not application failures. No database migrations, app services, app test suite, app dependency installation or deployment/configuration changes were run.

### Final check accounting

Counts select the latest completed run of each script, retaining environment checks separately. One check can contain several related HTTP assertions; these are **check counts**, not endpoint totals, case exhaustiveness or coverage percentages.

| Selected run | Passed | Failed | Blocked | Total |
|---|---:|---:|---:|---:|
| Environment `19-15-26-234Z` | 6 | 0 | 0 | 6 |
| API `19-30-07-899Z` | 29 | 1 | 6 | 36 |
| Browser `19-32-51-528Z` | 19 | 3 | 0 | 22 |
| Follow-up `19-55-41-346Z` | 7 | 0 | 0 | 7 |
| **Final selected checks** | **61** | **4** | **6** | **71** |

Four failed checks correspond to four confirmed defect records. Earlier harness failures, dependency cascades and superseded runs are not added to the final selected count. They remain visible in the full run ledger below; they were not treated as extra product defects.

### Exact executed test commands and run ledger

Working directory for all commands: `C:\Users\micha\qa\src\n5deal-qa-assignment`. All eight completed scripted exploratory runs exited 0 because these scripts record and continue after individual check failures. **Exit 0 means the exploration script finished, not that every check passed**; `checks[].status` and the table below are authoritative. Source scripts were corrected between superseded runs.

| Command | Artifact run (prefix `artifacts/`) | P / F / B | Interpretation |
|---|---|---|---|
| `node scripts/exploratory/environment.cjs` | `2026-10-15T19-15-26-234Z-environment` | 6 / 0 / 0 | Selected; availability, accounts, browser and isolated create/delete |
| `node scripts/exploratory/api-exploration.cjs` | `2026-10-15T19-22-40-558Z-api-exploration` | 9 / 1 / 26 | Superseded; upload header could not be extracted statically; dependent file checks blocked. API-09 is first BUG-002 reproduction. |
| `node scripts/exploratory/browser-exploration.cjs` | `2026-10-15T19-28-09-220Z-browser-exploration` | 8 / 9 / 2 | Superseded; duplicate New folder locator and Close link-role mismatch caused harness failures/cascades. Valid upload/download did execute successfully. |
| `node scripts/exploratory/api-exploration.cjs` | `2026-10-15T19-30-07-899Z-api-exploration` | 29 / 1 / 6 | Selected; browser-observed client upload header enabled complete API flow. The browser-only probe PUT was locally cancelled; its pending row was removed with the subtree. |
| `node scripts/exploratory/browser-exploration.cjs` | `2026-10-15T19-31-05-870Z-browser-exploration` | 15 / 4 / 0 | Superseded; UI-13 asserted Move before modal completion. Corrected waiting made Move pass; three other failures reproduced in the next run. |
| `node scripts/exploratory/browser-exploration.cjs` | `2026-10-15T19-32-51-528Z-browser-exploration` | 19 / 3 / 0 | Selected; BUG-001/003/004; added public/cached-revocation/recursive-delete checks |
| `node scripts/exploratory/follow-up.cjs` | `2026-10-15T19-54-03-783Z-follow-up` | 2 / 5 / 0 | Superseded; drop dispatched before explorer was ready; dependent file checks failed. Session error UI was reached, but its recovery assertion depended on missing fixture. |
| `node scripts/exploratory/follow-up.cjs` | `2026-10-15T19-55-41-346Z-follow-up` | 7 / 0 / 0 | Selected after waiting for attached file input; all follow-up assertions passed |

Across **all runs including repeats and superseded harness outcomes**, the raw ledger contains 95 passed, 23 failed and 34 blocked records (152 total). Those totals must not be presented as distinct product scenarios or 23 product bugs. All eight cleanup checks passed.

Additional executed setup/diagnostic commands:

- `npm.cmd exec --yes --package=@playwright/test@1.56.1 -- playwright --version` — initial sandbox run failed with npm-cache EPERM; approved retry succeeded, reporting `Version 1.56.1`.
- `node scripts/exploratory/environment.cjs` — one pre-execution sandbox attempt failed to create its artifact directory (EPERM); it executed no product checks. The approved run is in the ledger.
- `node --version`, `npm.cmd --version` — versions above.
- `node --check scripts/exploratory/environment.cjs`, `node --check scripts/exploratory/api-exploration.cjs`, `node --check scripts/exploratory/support.cjs`, `node --check scripts/exploratory/browser-exploration.cjs`, `node --check scripts/exploratory/follow-up.cjs` — syntax checks exited 0.

Scripts preserve reusable exploratory logic without introducing a large framework. Credentials are read in memory from the supplied README. Playwright contexts/tokens, signed URLs and client upload headers are not persisted; JSON evidence redacts them. Traces/storage-state files were deliberately not saved because sanitized HTTP records/screenshots were sufficient.

## 2. Functionality actually tested

| Area | Executed coverage | Final check IDs |
|---|---|---|
| Environment | Frontend/API availability, both test logins, Chrome automation, isolated folder create/delete | ENV-01–06 |
| Authentication/state | Valid/invalid browser and API login, missing/malformed bearer denial, reload persistence, logout/account switch, invalid-session redirect, client-simulated `/auth/me` 5xx recovery | API-01–02; UI-01–02,07,17–18; FOLLOW-04 |
| Folders | Root/nested create, trim/rename, case-insensitive conflict, blank names, breadcrumbs/refresh, one-level cursor seams, preview counts, normal recursive deletion and preview-error dialog | API-03–07,14–15,27; UI-03–08,16,21 |
| Files | Intent, pending invisibility, premature completion, valid storage PUT/confirm, multiple UI uploads, drag/drop, unsupported MIME/type, zero/over-limit declared size, rename/move/conflicts, download bytes/filename, delete and subsequent 404s | API-08–15,23–28; UI-09–14; FOLLOW-01–02 |
| Sharing/access | Other-account isolation, inherited USER reads, hidden ancestors, sibling/room denial, mutation/share-management denials, sequential dedup, public subtree scope, overlapping grants, fresh revocation, move-induced access changes, single-file public scope | API-04,12,16–23,29; UI-15,19–20; FOLLOW-03,05 |
| Browser UX | Loading/form/error states, deep links, PDF object/open/close, native PDF visual rendering, public nested navigation/revoked message, keyboard open semantics and public keyboard Download | UI-03,06–08,12,16,19,21; FOLLOW-03–04,06 |

Only assessment-created resources were opened or mutated for content testing. Received-share evidence was filtered to assessment share IDs; no arbitrary user IDs or unrelated shared documents were probed. Room-level details were read to select each documented account's existing room, but no entire pre-existing room was publicly shared.

## 3. Passed scenarios

The 61 passed selected checks are individually recorded with IDs/durations in the four selected `execution.json` files. Significant positive results:

- Both accounts authenticate; invalid credentials/session headers are rejected. Session reload and account switch did not expose the previous account's owner actions/data in the checked flow.
- The second documented account cannot read the owner's unshared assessment folder/file. Viewer inheritance works within the shared subtree; names above the share boundary are omitted; nine owner-only mutation operations and share-management calls return 404.
- Sequential USER/public grant creation deduplicates. Revoking the only remaining grant denies new USER file metadata/view/download requests; public revocation returns 410. A separate direct file grant correctly survives parent-grant revocation and movement.
- Valid PDFs upload, complete and return exact expected bytes. Filename conflict handling, same-folder moves, cross-room rejection, rename/download filenames, small-limit mixed pagination and normal deletion passed.
- Two-file upload and drag/drop passed. Declared unsupported MIME, zero bytes and size above 50 MiB were rejected at intent validation; the oversized payload itself was never uploaded.
- Public file PDF rendered visibly in Chrome: [native preview screenshot](../artifacts/2026-10-15T19-55-41-346Z-follow-up/single-file-public-preview.png). Public Download via Enter did not also navigate the row.
- Client-simulated session-check 500 produced a retry screen and recovered after interception was removed. Normal delete preview correctly warned of a nested folder before successful deletion.
- Every run's created-share/root cleanup completed. API cleanup additionally checked tracked file metadata absence. Physical storage deletion is not established by these checks.

## 4. Failed scenarios

| Failed selected check | Observed result | Finding |
|---|---|---|
| API-09 | Complete before PUT returns 500 `Could not verify the upload`, rather than actionable incomplete-upload 400 | BUG-002 |
| UI-08 | Folder row is unfocusable TR with no open link/action | BUG-004 |
| UI-14 | Retry after successful PUT and one simulated completion error performs another PUT, receives 400 and remains failed | BUG-001 |
| UI-16 | Failed preview leaves Delete enabled without nested-content fallback warning | BUG-003 |

Each has two independent valid-fixture reproductions. The main browser run's simulation only changed responses in that browser context; the API, deployment, database and bucket were not faulted. Full preconditions, actual/expected behavior, reproduction steps and evidence are in [findings.md](findings.md).

## 5. Blocked or not-executed scenarios

Exactly six checks were recorded blocked in the selected API run:

| ID | Why blocked |
|---|---|
| H01 | Only existing documented accounts allowed; no authorized unused mailbox/account or supported account deletion |
| H03-RACE | Concurrency experiments on shared infrastructure require separate authorization |
| H04-RACE | Same authorization boundary for sibling-name races |
| H06-CEILING | No dedicated bucket/configuration access for actual oversized/content-policy experimentation; metadata limits and small size reconciliation tested |
| H07-INFRA | No privileged DB/bucket observability or server/storage failure-injection authorization |
| H10-PERSISTENT | Registration/data-room whitespace API tests can create unnecessary permanent resources with no deletion endpoint |

Other **not executed**, without inflating blocked-check counts: actual seven-day expiry wait/signature manipulation; waiting out the signed-URL lifetime; cross-tab logout; sharing the entire pre-existing room; deletion races or deleting resources belonging to others; full browser/device/load/security assessments; direct infrastructure inspection. Existing plan exclusions still apply.

## 6. Confirmed defect summary

**4 distinct defects:** High **1**, Medium **2**, Low **1**, Critical **0**. There are no application fixes in this stage. The High defect affects upload recovery; Medium defects affect incomplete-upload API errors and destructive-action warnings; the Low defect affects keyboard folder navigation.

No environment-wide upload outage was inferred from BUG-002: normal PUT/complete/read/download succeeded. No fresh authorization bypass was inferred from cached display or previously signed URLs: fresh checked requests were rejected after revocation.

## 7. Important product risks

1. **Recipient identity remains unverified (H01):** static discovery indicates email-string-based grants without mailbox proof, but the permitted accounts cannot reproduce the new-address scenario. Confidentiality impact could be Critical if reproduced.
2. **Atomic sharing/naming invariants remain unverified (H03/H04):** sequential behavior passed; concurrent duplicate grants/names were not exercised. Residual hidden-grant and naming risks are not confirmed defects.
3. **File recovery and revocation/storage boundaries:** BUG-001 is confirmed; DB/object cleanup consistency and actual upload ceilings remain partly unknown. Open pages kept cached metadata and pre-issued URLs remained usable immediately after revoke, while fresh authorization failed. These latter behaviors need explicit product expectations rather than automatic defect labels.

## 8. Limitations of this testing session

- Limited to two documented accounts, synthetic small documents and isolated subtrees; no claim of complete product/endpoint/permission coverage.
- Local source informed hypotheses, but no deployed commit/configuration parity was established.
- Native PDF rendering was visually confirmed for one synthetic PDF in one Chrome version; earlier screenshots captured the plugin before painting and do not establish rendering failure.
- Preview, completion and session error handling used **client-local response simulation**. They establish UI recovery behavior under those responses, not actual infrastructure outage probability or backend rollback behavior.
- Browser locator/readiness mistakes occurred during script development. The full raw ledger preserves these; only corrected selected runs define final counts. Move passed after waiting for its modal/network completion.
- No raw traces/HARs, saved auth state, credential-bearing requests, signed URLs or unfiltered received-share content were intentionally retained. Selected screenshots were inspected; text artifacts were scanned for secret patterns/known credentials before handoff.
- Cleanup proves tracked API metadata/root absence and revoked grants, not physical object reclamation. Automatic cleanup of abandoned uploads is a documented MVP omission.

## 9. Recommended automation candidates

Preserve the exploratory scripts as starting points and later convert a small set into ordinary Playwright tests:

1. Owner/Viewer API boundaries, subtree inheritance, hidden ancestor names and owner-only mutations.
2. USER/public revocation with overlapping direct grants and file movement.
3. Valid PDF upload plus idempotent recovery after PUT succeeded and completion failed — regression for BUG-001.
4. Pending-upload visibility and actionable incomplete-upload errors — BUG-002 regression.
5. Naming conflicts, move identity, mixed pagination and recursive metadata cleanup.
6. Browser account/cache isolation, session error recovery, public PDF/download and keyboard navigation.
7. Destructive dialog behavior on preview error — BUG-003 regression; keyboard open action — BUG-004 regression.

Keep concurrency, identity-ownership and storage fault tests blocked until the required environment/authority exists. Review the four findings, agree on revocation/preview/accessibility expectations, then implement focused regression automation in the QA repository. No final release-readiness recommendation is made here, and `qa-report.md` remains unchanged.
