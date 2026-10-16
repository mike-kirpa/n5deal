# Automation implementation and execution record

Date: 2026-10-16. This is an automation execution record, **not** the final QA report or a release-readiness decision. Historical exploratory reports/findings remain unchanged.

## Verified target and safety

- QA repository: `n5deal-qa-assignment`; sibling application `virtual-data-room` remained read-only.
- Web: `https://virtual-data-room-ten.vercel.app`; API: `https://virtual-data-room-production.up.railway.app`.
- Node 24.14.0, npm 11.9.0, Playwright Test 1.56.1, TypeScript 5.9.3, installed Chrome 155.0.8059.79 (Chromium engine).
- Only the two README-documented users; credentials supplied in child memory by the explicit launcher, not printed or persisted.
- Health and both logins checked before each worker's tests. One worker, zero retries. No new account/room, baseline document change, race/load test, infrastructure change or application fix.
- Scope: unique assessment roots, small generated PDFs, scoped grants. BUG-001/003 intercept only the current browser page, not the server. No Delete click through failed preview.

## Commands actually executed

From the QA repository in PowerShell (Windows uses `npm.cmd`; README's `npm` is equivalent):

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund
npm.cmd run typecheck
npm.cmd test -- --list
npm.cmd run test:all -- --list
npm.cmd run test:documented -- --project=api
npm.cmd run test:documented -- --project=chromium
npm.cmd run test:documented -- --project=known-api --project=known-chromium
# Repeat after fixing attachment persistence; assertions were not weakened:
npm.cmd run test:documented -- --project=api --project=chromium
npm.cmd run test:documented -- --project=known-api --project=known-chromium
node scripts/exploratory/environment.cjs
npm.cmd run audit:artifacts
npm.cmd run test:report
```

Typecheck was rerun after changes and passed. Final stable collection listed 13 tests without executing them. The known projects contain four additional tests. `npm ci`, downloaded Chromium installation, headed mode, and separate environment-backed `test:api` / `test:e2e` aliases are documented but were not separately executed; real runs used the same projects through `test:documented` and installed Chrome. The original command can also run with configured environment variables.

The final all-project `--list` also collected all 17 scenarios successfully, without execution. Application Git status was clean at HEAD `4a787b43bd921be48f5ab11e30828b97b8c5ee0c`; the file-hash comparison independently matched all 194 baseline files. No global Git ownership settings were changed.

## Complete new-framework execution ledger

All run IDs below are UTC. Paths are relative to `artifacts/automation/`.

| Run ID | Projects | Passed | Expected-failed | Unexpected-failed / pass | Skipped / blocked | Cleanup scopes |
|---|---|---:|---:|---|---|---|
| `2026-10-16T09-14-23-907Z-58491901` | api | 10 | 0 | 0 / 0 | 0 / 0 | 8 passed; 2 no data |
| `2026-10-16T09-16-04-758Z-8996a5bb` | chromium | 3 | 0 | 0 / 0 | 0 / 0 | 3 passed |
| `2026-10-16T09-18-36-893Z-b6eaecd0` | known-api, known-chromium | 0 | 4 | 0 / 0 | 0 / 0 | 4 passed |
| `2026-10-16T09-35-44-173Z-d36d51da` | api, chromium; evidence-complete repeat | 13 | 0 | 0 / 0 | 0 / 0 | 11 passed; 2 no data |
| `2026-10-16T09-37-58-788Z-749df03b` | known-api, known-chromium; evidence-complete repeat | 0 | 4 | 0 / 0 | 0 / 0 | 4 passed |

Final selected result: **13 ordinary passes, 4 expected failures, 0 unexpected failures, 0 unexpected passes, 0 skipped, 0 blocked, 0 cleanup failures** across 17 unique scenarios. Runner/global errors in these executions: 0. The four actual failed assertions are known product defects, not ordinary passes. Playwright's overall runner exit is 0 because these failures are anticipated with `test.fail()`; a new failure or unexpected pass is not accepted.

Across all five execution attempts: 34 test attempts = 26 ordinary passes + 8 expected failures. Repeated attempts do not increase unique coverage. The separate legacy smoke run `artifacts/2026-10-16T09-39-12-762Z-environment/` passed 6/6 and cleaned its one temporary folder; it is not counted as six additional Playwright scenarios.

Final evidence-complete reports:

- [Stable 13-test report](../artifacts/automation/2026-10-16T09-35-44-173Z-d36d51da/report.md), [JSON](../artifacts/automation/2026-10-16T09-35-44-173Z-d36d51da/results.json).
- [Known-bug report](../artifacts/automation/2026-10-16T09-37-58-788Z-749df03b/report.md), [JSON](../artifacts/automation/2026-10-16T09-37-58-788Z-749df03b/results.json).

## Product observations in the final regressions

| Bug | Actual observation | Correct assertion / result |
|---|---|---|
| BUG-001 | Original real storage PUT 200; one client-simulated completion 500; Retry PUT 400; only one completion request; file never published | Published file must become visible: expected-failure |
| BUG-002 | Intent 201; no bytes sent; completion 500 with `Could not verify the upload` | Must be HTTP 400: expected-failure |
| BUG-003 | Nested folder exists; locally failed preview; Delete enabled; zero explicit unknown-content warnings; Cancel clicked | Disabled OR explicit unknown-content warning: expected-failure |
| BUG-004 | 30 real Tab steps with Enter on row actions; menu has no Open action; folder not entered. Row TR, tabIndex -1, no link | Keyboard traversal must open the nested folder: expected-failure |

BUG-001/002 expected markers additionally require the recognized defect signature (or a correct outcome, which becomes unexpected-pass). Other terminal statuses stay unexpected failures. Infrastructure/setup failures before defect assertions and cleanup/browser-close failures cannot masquerade as known defects. Unexpected failures still require investigation; the reporter does not label every unknown failure a product bug.

Each final scenario has a persisted `attachments/*-sanitized-evidence.json`; the final known run also has three PNGs. Screenshots were visually reviewed: only owned QA content, no password/JWT/signed URL visible. BUG-004's screenshot is supplemental; keyboard observations in JSON are the behavioral evidence. No raw DOM snapshot/trace/HAR/video was emitted.

## Automation/setup incidents and corrections

1. An initial `npm.cmd test -- --list` under the restricted filesystem token could not create the output directory (EPERM). No tests executed. The old reporter's hook exception did not produce a reliable nonzero exit; output-directory creation was moved into reporter construction and report/attachment write errors now fail the run. The command was rerun with the required filesystem approval. This is one local setup incident, not a product test failure.
2. The approved early collection created `2026-10-16T09-09-57-812Z-9311f708` with zero tests. It is retained, but is **collection only**, not a passed execution. `--list` now prints collected cases without creating an execution report.
3. First executions correctly classified assertions and cleanup, but the custom reporter retained attachment names while buffer data stayed in memory. Their summaries remain historical evidence; they do not contain the promised HTTP/PNG files. The reporter now explicitly persists only allowlisted sanitized JSON and bug PNG attachments, with write failure propagated. Both suites were repeated in full to obtain complete evidence. No product assertion was relaxed and no application code changed.
4. Before the E2E execution, in-memory browser authentication setup was adjusted to use initial storage state instead of an init script that could re-seed Owner credentials after logout. During final review, bundled-Chromium selection in the extracted upload bootstrap was aligned with environment configuration while retaining the original exploratory Chrome choice. BUG-001/002 marking was narrowed to recognized signatures. Diagnostic labels for explicit environment/automation errors were tightened after the evidence runs; this changes reporting only, not requests/assertions; final typecheck passed.

No deployed-suite automation failure occurred in the five execution attempts. These setup/reporting corrections are disclosed instead of counting them as product regressions or silently discarding the first runs.

## Cleanup verification and limits

The final selected runs passed cleanup for all **15 resource scopes**; two authentication tests created no resources. Successful grant revocation preceded root DELETE. Subsequent folder-content/file-metadata reads returned 404 for tracked IDs; **15 tracked file IDs** were checked across stable and known runs, including probe/pending intents. The legacy smoke's separate root DELETE and subsequent 404 also passed.

Pending files already returned 404 before deletion, so their actual DB purge relies on the successful recursive-root delete contract; no privileged DB query independently verifies it. Physical storage deletion, provider orphan reclamation/backups and already-issued signed-URL expiration were not verified. Process termination, a lost create response or an outage can still require scoped recovery. No cleanup by broad prefix or baseline modification was performed.

## Final quality checks and changed files

- A SHA-256 baseline comparison found all **194 application files unchanged**. All 50 pre-task QA files remain present; exactly six were modified as authorized: package, config, README, gitignore, testing approach and exploratory support. Historical artifacts/findings/exploratory report/test plan/discovery/QA-report placeholder hashes are unchanged. Other four exploratory scripts are unchanged; the original environment entry point passed after extraction.
- `npm.cmd run audit:artifacts`: 34 automation text files scanned, 3 PNGs requiring review, 0 pattern findings. All three PNGs and the legacy empty-login PNG were visually reviewed. A broader credential/JWT literal scan over QA text files also found no matches; no real `.env`, auth state, raw traces or HARs were created. Pattern scanning is not a mathematical proof of secret absence.
- Added `.env.example`, `tsconfig.json`, lockfile; one TS fixture; typed API/environment/scope/UI/reporter helpers, shared CJS support/declaration; launcher/report/audit scripts; three API spec files, one journey spec, two regression specs; this execution document; new sanitized evidence. No second config, copied product unit tests, page-object hierarchy or extra dependency stack.
- Reused/refactored/new components and reasons are detailed in [testing approach](testing-approach.md). Product unit tests were inspected read-only (42 unit cases plus one health e2e), not newly executed or copied. README commands map to actual package scripts.

Remaining scope limits: Chromium only; tiny synthetic PDFs/two users; no permanent account/room flows, race/stress/storage-policy experiments, full accessibility/security audit or physical cleanup proof. The four product defects remain reproducible. This record does not replace confirmed findings and does not make a release decision.

## Access Revocation and Upload Validation Extension

Executed 2026-10-16, separately from the baseline ledger above. Run: `2026-10-16T12-27-49-891Z-7d6f2801`, ending at 12:32:24 UTC. [Report](../artifacts/automation/2026-10-16T12-27-49-891Z-7d6f2801/report.md) · [JSON](../artifacts/automation/2026-10-16T12-27-49-891Z-7d6f2801/results.json).

### Coverage selection and execution

Reused all 13 stable scenarios, including existing sharing/move/revocation checks, 0/max+1 size rejection, text/plain rejection and valid PDF API/UI lifecycles. Existing spec files and known-defect assertions were not modified. Added 16 API and seven browser scenarios in `access-revocation.spec.ts` and `file-validation.spec.ts` under the existing API/E2E directories. One additional expiration scenario is opt-in only.

Actual commands from the QA repository in Windows PowerShell:

```powershell
npm.cmd run typecheck
npm.cmd run ci:discover
npm.cmd run test:expiration -- --list
npm.cmd run test:documented -- --project=api --project=chromium --global-timeout=600000
npm.cmd run audit:artifacts
```

The first three checks passed before the live run; typecheck, discovery and artifact audit also passed after it. `node --check scripts/run-expiration.cjs` passed. The launcher verified the documented hosts and two accounts, supplied credentials only in child memory and used installed Chrome. No credentials were printed or written to `.env`. No large-file upload, new account/room, load experiment, application change, workflow dispatch or commit/push was performed.

| Executed layer | Passed | Failed / expected-failed | Skipped / blocked |
|---|---:|---|---|
| API | 26 | 0 / 0 | 0 / 0 |
| Chromium E2E | 10 | 0 / 0 | 0 / 0 |

Total: **36 passed = 23 new scenarios + 13 existing retests**; zero unexpected passes, global errors or cleanup failures. These are not 36 additional unique scenarios. Four passing characterization probes record extension/content behavior, not successful rejection of invalid PDFs. The four baseline known-defect regressions were not selected or rerun here; their historical expected-failed results and the four open findings remain unchanged.

### Verified revocation behavior

- USER folder sharing: file metadata, view-URL and download-URL requests returned 200 before revoke, then 404 from a fresh authenticated context. Owner reads remained 200; Viewer mutation attempts stayed 404. The grant disappeared from the active share list.
- File public link: summary, metadata, view-URL and download-URL routes returned 200 before revoke, then 410. Unknown-token requests returned 404. A renewed public share used a different token; the old token remained 410. Independent USER and Owner reads stayed 200.
- Overlapping grants: revoking the folder grant preserved all three file reads through the direct grant. Folder/ancestor/sibling contents stayed inaccessible. Revoking the direct grant then returned 404 for all three file reads.
- An old signed view URL returned 200 and the original PDF bytes immediately after USER revocation; fresh API authorization was denied. This is independent storage capability access, not a confirmed fresh authorization bypass.
- An already-open PDF object remained visible immediately after revoke. In the two-tab case, the cached filename and PDF object also remained visible. Fresh download returned 404; navigation/reload showed `File not found` or `Folder not found`, with no successful new URL issuance. Native page rendering and immediate cache erasure are not claimed.
- Under a client-local delay of an already-authorized download-URL response, the download completed with the original bytes after revocation. The next download authorization returned 404. This demonstrates controlled client timing, not interruption or cancellation of a real storage transfer.

### Verified upload-intent boundaries

All values below were tested as API metadata only. Accepted pending intents were tracked; no large bytes or 1-byte PDF were uploaded.

| Declared size | HTTP result | Coverage source |
|---|---:|---|
| 0 | 400 | Existing stable test, rerun |
| 1 | 201 | New metadata-only case |
| 52,428,799 | 201 | New boundary case |
| 52,428,800 | 201 | New boundary case |
| 52,428,801 | 400 | Existing stable test, rerun |
| -1 | 400 | New negative case |
| 1.5 | 400 | New fractional case |
| `not-a-number` | 400 | New non-numeric case |

### MIME, extension and actual content

| Probe | Actual result | Interpretation |
|---|---|---|
| Valid PDF, application/pdf | Intent/completion 201; exact downloaded bytes | Existing API/UI flows passed again |
| text/plain, image/png, missing API MIME | Intent 400 | Declared MIME rejected; not evidence of content inspection |
| `.txt` name with application/pdf | Intent 201; valid PDF also published through UI | No filename-extension restriction observed |
| `.pdf` with 40 non-PDF bytes | PUT 200, completion 201, metadata size 40, identical download | Content accepted, not a PDF-validity pass |
| Truncated 40-byte PDF with application/pdf | PUT 200, completion 201, metadata size 40, identical download | Corrupted content accepted, not a PDF-validity pass |
| Browser text/plain / image/png with `.pdf` name | Rejection message; zero intent requests | Client MIME check rejects before API upload |
| Browser empty MIME with `.pdf` name | API submitted application/pdf; file published | Client extension fallback differs from API missing-MIME rejection |

Acceptance of unsupported/corrupted content is an observation requiring a defined content policy and impact review, not a newly confirmed defect. No malicious payload or full parser/security test was used.

Small-size mismatch probes declared 591 and 613 bytes for a 602-byte valid PDF. Both completed with 201 and metadata size 602; downloads matched the original bytes. This verifies actual-size reconciliation for small files, not enforcement of a 50 MiB actual-object ceiling. Bucket settings and oversized-content enforcement were not inspected.

### Cleanup, privacy and remaining gaps

All **34 resource scopes** recorded successful root deletion followed by metadata 404s; two auth tests created no data. There were 39 tracked file IDs verified absent, including pending/probe intents. Shares were revoked before root deletion. Pending-row purge still relies on the recursive-root contract because pending metadata was already invisible; physical Supabase object deletion is not proven.

All 36 sanitized JSON attachments exist. No new screenshots or raw traces/HAR/video/auth state were produced. The artifact audit checked 73 text files and the three existing PNGs, with zero issues. No new visual/human screenshot review is claimed; automated scans are not a guarantee of secret absence.

Normal discovery collects 40 tests, excludes expiration and changes no artifacts. The opt-in command collects one expiration test; **it was not executed or counted as skipped/passed**. Actual expiry enforcement therefore remains unverified. The test uses the URL's expiry claim in memory plus a safety margin, fresh no-cache HTTP reads and fixture teardown; an unreadable expiry is an automation limitation, not an invented result. In-memory parser sanity checks accepted a synthetic valid expiry and rejected missing/expired/too-long values; these were not product executions. An additional collection-only check enabled the opt-in flag while selecting the four regular projects and still collected only 40 cases. Default npm/CI suites therefore exclude expiration even when its project is enabled. Workflow security/concurrency, reporter, lockfile and dependencies are unchanged.

H01, infrastructure faults, real transfer interruption, oversized storage behavior, native PDF rendering and full security/accessibility coverage remain gaps. No new confirmed defect or release-decision change resulted from this extension. See [testing approach](testing-approach.md#access-revocation-and-upload-validation-extension) for execution modes and maintenance details.

## Review Follow-up and Clean Export Verification

Executed 2026-10-16 on Windows, Node 24.14.0, Playwright 1.56.1 and its downloaded Chromium 141.0.7390.37 (build 1194). A new temporary working-tree export excluded `.git`, dependency installs, local credential files and runtime pointers. `npm ci` installed the lockfile dependencies, followed by `npx playwright install chromium`. This was not a committed checkout or a Linux/remote CI run.

Credentials were read from the authorized source README by the parent launcher and passed only through child-process environment variables. The exported framework had no sibling application checkout or `.env`; standard npm commands ran with `QA_BROWSER_CHANNEL` empty. No credential file was created.

### Selected Current Results

| Command | JSON evidence | Result |
|---|---|---|
| `npm test -- --global-timeout=600000` | [13-07 stable](../artifacts/automation/2026-10-16T13-07-52-314Z-1c0d5029/results.json) | 25 API + 12 E2E passed |
| `npm run test:known-bugs -- --global-timeout=300000` | [13-14 regressions](../artifacts/automation/2026-10-16T13-14-45-120Z-9c087817/results.json) | 4 expected-failed, BUG-001–004 |
| `npm run test:characterization -- --global-timeout=300000` | [13-16 characterization](../artifacts/automation/2026-10-16T13-16-12-412Z-a9e147c0/results.json) | 4 probes recorded; excluded from contract coverage |

All three completed with effective status passed, zero global errors, zero unexpected failures/passes and zero skipped/blocked tests. Expected failures remain open product defects. Stable and known-defect teardown were checked before the next live suite began.

The earlier 36-test extension included four characterization probes. They were moved with their assertions unchanged to `tests/characterization/`, then five contract scenarios were added: two API security tests and three browser safety/batch tests. Thus current stable coverage is **36 minus 4 plus 5 = 37 scenarios**, not 37 additional tests. The direct-file browser revocation scenario was strengthened to use Owner UI Revoke; the unused Owner context was removed from the separate API-to-two-Viewer-tabs flow.

### New Checks and Actual Observations

- **Storage capability:** two tiny owned PDFs provided positive controls (200, exact original bytes). Missing token, changed JWT signature and swapping to the other owned object path each returned 400 and neither original payload. Provider errors/throttling are inconclusive, not successful denial.
- **JWT integrity:** changing the Viewer payload toward the documented Owner, changing the signature and using unsigned `alg:none` each returned 401 for `/auth/me` and owned-folder contents. This does not test a legitimately signed expired JWT or every JWT configuration issue.
- **Owner UI revoke:** the sharing dialog's Revoke returned 204; Viewer fresh download/reload was denied while Owner access remained valid.
- **Literal names:** a harmless `<b>`/ampersand/quotes folder name appeared as text, not a bold element, in Owner, Viewer and public listings. This is a focused escaping check, not comprehensive XSS testing.
- **Deletion during viewing:** Owner deleted its own child folder through a normal successful preview (204); Viewer reload showed Folder not found and fresh file reads returned 404. The grant was on the surviving assessment root, allowing safe revocation in teardown.
- **Batch upload:** one browser-local PUT failure occurred before storage acceptance. The other file remained Uploading with progress 100 while completion was held, then published successfully. Retry recovered the failed file without duplicate listing entries. This differs from BUG-001's post-storage completion failure.
- **Characterization:** `.txt` with PDF MIME remained accepted; 40-byte non-PDF and truncated PDF content completed with 201 and downloaded unchanged. These observations do not establish a content-policy defect.

### Harness and Static Verification

`npm run test:unit` passed four dependency-free Node tests for redaction/non-mutation, known-defect versus pass classification, lifecycle-error precedence and expiration outcomes. These protect QA support code, not product functionality. `npm run typecheck` passed. `ci:discover` collected 45 cases without fixtures/live requests or artifact changes: 37 stable, four known-defect and four characterization. The opt-in expiration command collected one case, not executed or counted as skipped.

The expiry oracle now checks a fresh Owner URL for the same file and original bytes after the wait. Server errors, throttling or an unhealthy positive control cannot count as expiration success. This logic is unit-tested; actual provider expiry remains unverified. Static CI now includes the unit command; live CI still excludes characterization/expiration. No dependencies, application source or existing known-bug assertions were changed.

### Cleanup and Evidence

Cleanup passed for **43 scopes**: 35 stable, four regression and four characterization; two stable auth checks needed no resources. Across them, **48 tracked file IDs** returned metadata 404 after cleanup. This is not evidence of physical object deletion or independent pending-row purge.

All 45 sanitized JSON attachments and three new bug PNGs exist. New PNGs were visually inspected with AI assistance and showed only synthetic assessment content/documented account UI, not credentials or share-token fields; no independent human review is claimed. Only reports/approved attachments were copied back, without runner pointers. Historical evidence was not overwritten or deleted. The export artifact scan checked 121 text files and six PNGs; the repository scan after copying checked 124 text files and six PNGs. Both found zero pattern issues; scans are not guarantees.

Remaining execution gaps: H01/disposable identity support, isolated whole-room sharing, actual expiry, legitimately signed expired auth tokens, actual storage ceiling/physical reclamation and controlled infrastructure/race tests. No new confirmed defect was added; Conditional No-Go for real confidential documents is unchanged.
