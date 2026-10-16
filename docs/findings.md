# Findings

This is the main source for confirmed defect details, supporting evidence and unresolved product questions. Start with the [Final QA Report](qa-report.md) for results and release readiness, or return to [README](../README.md) for navigation.

The four confirmed defects remain open. Later reusable automation reconfirmed each with an expected-failed regression; these are not successful product behaviors. See [automation execution](automation-execution.md#product-observations-in-the-final-regressions). The exploratory reproduction counts below describe the original runs, not a combined total.

## Executed exploratory assessment — 2026-10-15

Testing target: the deployed frontend and API documented in the application README. Browser: Chrome 155.0.8059.79, headless, Playwright 1.56.1 on Windows. Only `john@example.com`, `viewer@example.com` and assessment-created synthetic folders/PDFs were used. No new accounts/rooms, infrastructure changes, concurrency experiments or server/storage failure injection were performed.

Results below describe executed behavior. Source references identify plausible implementation causes in the local read-only checkout; deployed source/build parity was not established. Full execution accounting is in [exploratory-report.md](exploratory-report.md), with artifact conventions in [artifacts/README.md](../artifacts/README.md).

## Confirmed bugs

| ID | Title | Category | Severity | Priority | Related discovery |
|---|---|---|---|---|---|
| BUG-001 | Upload Retry fails after bytes were uploaded but completion failed | File upload / recovery | High | P1 | H05 |
| BUG-002 | Completing a not-yet-uploaded file returns HTTP 500 | API error handling | Medium | P2 | Upload lifecycle |
| BUG-003 | Delete remains enabled after delete-preview fails | Destructive-action UX / validation | Medium | P2 | H09 |
| BUG-004 | Folder rows have no keyboard-operable open target | Accessibility / navigation | Low | P2 | Frontend keyboard coverage |

No Critical defect or tested authorization bypass was confirmed. This does not establish that the untested identity/concurrency hypotheses are safe.

### BUG-001 — Upload Retry fails after bytes were uploaded but completion failed

- **Environment:** deployed frontend/API, owner test account, Chrome/Playwright versions above.
- **Preconditions:** assessment-owned folder; small valid synthetic PDF; normal upload succeeds in this environment. A single completion error is simulated in the browser using Playwright routing; no backend/storage service is altered.
- **Steps:**
  1. Sign in as the documented owner and open an assessment folder.
  2. Intercept the next POST `/files/:id/complete` and fulfill that one browser response with HTTP 500 and a synthetic outage message.
  3. Upload `retry-recovery.pdf`. Allow the actual signed storage PUT to finish successfully.
  4. When the upload panel displays the completion error, click its Retry button.
- **Expected:** recovery finishes confirmation using the existing successful upload, publishing exactly one document without requiring the user to upload it again under a new name.
- **Actual:** Retry sends another PUT for the existing storage object. That PUT returns **400**, and the panel shows `Upload failed with status 400`; the document remains absent from the listing. The retry cannot reach successful confirmation.
- **Reproducibility:** **2/2 independent controlled browser runs**, `UI-14` in runs `2026-10-15T19-31-05-870Z-browser-exploration` and `2026-10-15T19-32-51-528Z-browser-exploration`.
- **Evidence:** [latest execution JSON](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/execution.json), `UI-14`, browser HTTP records and explicit retry observation; [failure screenshot](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/retry-after-completion-failure.png). The synthetic completion response is identified as such in the evidence.
- **Requirement/source:** reliable upload/error handling, `virtual-data-room/task.md:13,41,61`; `apps/web/src/features/data-room/upload/use-upload-queue.ts:55-67,132-138` reuses the intent but repeats PUT before confirmation; `apps/web/src/features/data-room/upload/api.ts:42-54` uses no-upsert and rejects the retry response. Source suggests the reason, but the provider's internal rejection cause was not inspected.
- **Impact:** transient confirmation failures can strand already-transferred documents and block a core user workflow. Pending-row cleanup remains a separately documented MVP limitation.

### BUG-002 — Completing a not-yet-uploaded file returns HTTP 500

- **Environment:** deployed API, documented owner, Playwright APIRequestContext.
- **Preconditions:** assessment-owned folder and an upload intent accepted with HTTP 201; no bytes have been uploaded for that intent.
- **Steps:**
  1. POST `/files/upload-intent` with a valid owned folder, PDF MIME and a small positive size.
  2. Do not use the returned upload URL.
  3. POST `/files/:fileId/complete` for that new file.
- **Expected:** an actionable client error explaining that upload did not finish, consistent with the service's `BadRequestException` path; no published file.
- **Actual:** **HTTP 500**, body `{"message":"Could not verify the upload","error":"Internal Server Error","statusCode":500}`. The pending file remains absent from contents, metadata, view-URL and download-URL reads (404).
- **Reproducibility:** **2/2 independent API runs**, `API-09` in `2026-10-15T19-22-40-558Z-api-exploration` and `2026-10-15T19-30-07-899Z-api-exploration`. Normal uploaded-file completion returned 201 in the later run, so upload completion was not universally unavailable.
- **Evidence:** [API execution JSON](../artifacts/2026-10-15T19-30-07-899Z-api-exploration/execution.json), `API-09` and the corresponding intent/complete/404 records; [first reproduction](../artifacts/2026-10-15T19-22-40-558Z-api-exploration/execution.json).
- **Requirement/source:** graceful error handling, `virtual-data-room/task.md:13,41`; `apps/api/src/files/files.service.ts:116-124`; `apps/api/src/storage/storage.service.ts:77-90`. A storage not-found mapping mismatch is a hypothesis, not an observed upstream response.
- **Impact:** an ordinary incomplete-upload state is exposed as a server failure, giving misleading recovery guidance and error classification. No data leak or corruption was observed.

### BUG-003 — Delete remains enabled after delete-preview fails

- **Environment:** deployed browser UI, documented owner, assessment-owned folder containing an uploaded PDF in the latest reproduction.
- **Preconditions:** a folder visible in the assessment listing; Playwright intercepts only that folder's GET `/folders/:id/delete-preview`, returning a client-simulated HTTP 500. The real backend and storage remain unchanged.
- **Steps:**
  1. Open that folder's row menu and choose Delete.
  2. Let the simulated preview request fail and automatic retries finish.
  3. Inspect the final dialog description and Delete button.
- **Expected:** prevent destructive confirmation until preview succeeds, or provide an explicit fallback warning that nested content will be removed despite the unavailable preview.
- **Actual:** dialog says `Could not check what's inside this folder.` and **Delete is enabled**. It gives no nested-content warning/count or unknown-content fallback. The test cancelled the dialog; it did not delete the fixture through this failed-preview path.
- **Reproducibility:** **2/2 controlled browser runs**, `UI-16` in the last two browser-exploration runs. Normal successful-preview deletion was separately executed and passed (`UI-21`).
- **Evidence:** [dialog screenshot](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/delete-enabled-after-preview-error.png), [execution JSON](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/execution.json), `UI-16`.
- **Requirement/source:** warn what nested content will be deleted, `virtual-data-room/task.md:57`; `apps/web/src/features/data-room/components/delete-folder-dialog.tsx:54-69` disables Delete during fetching/mutation but not on preview error.
- **Impact:** users can confirm permanent recursive deletion without the required information when preview fails. Acceptance of an explicit unknown-content warning instead of blocking is a product choice.

### BUG-004 — Folder rows have no keyboard-operable open target

- **Environment:** deployed owner browser UI, assessment folder listing with a nested folder.
- **Preconditions:** the owner can open the child folder by mouse; ordinary keyboard navigation is available.
- **Steps:**
  1. Open an assessment folder containing a child folder.
  2. Inspect the child row's focus/link semantics while navigating available controls with the keyboard.
  3. Compare the clickable folder name with the row's available action menu.
- **Expected:** a keyboard user can focus and activate a folder-open link/action, in addition to management actions.
- **Actual:** the clickable row is a `TR`, `tabIndex=-1`, with no role or child link. The only row button is the actions menu, whose items are Rename, Share and Delete; there is no Open action. Opening by mouse works, but folder opening has no keyboard target.
- **Reproducibility:** **2/2 valid child-folder fixtures**, `UI-08` in the last two browser-exploration runs. The very first browser run had a missing fixture and is excluded from this reproduction count. Automated evidence directly establishes DOM/focus semantics; no assistive-technology certification is claimed.
- **Evidence:** [execution JSON](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/execution.json), `UI-08`, includes `{"tag":"TR","tabIndex":-1,"role":null,"links":[]}`; [listing screenshot](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/folder-row-keyboard-navigation.png).
- **Requirement/source:** intuitive navigation and UX, `virtual-data-room/task.md:13,53`; requested basic keyboard testing; `apps/web/src/features/data-room/components/contents-table.tsx:230-243`; `folder-row-menu.tsx:33-53`. There is no explicit WCAG target in the supplied requirements.
- **Impact:** keyboard-only users cannot complete folder browsing through the listing. Public Download activated by Enter was separately tested and did not accidentally open its row (`FOLLOW-06`).

## Product issues and documented limitations

| ID | Observation | Classification / impact | Evidence |
|---|---|---|---|
| PROD-001 | A Viewer page already displaying the folder still shows its cached child name after owner revocation. Fresh API contents returns 404; reload shows Folder not found. | Observed refresh-policy issue; Medium confidentiality/UX concern, **not a fresh authorization bypass**. Product must specify how quickly metadata disappears. | Latest browser run `UI-20`; [screenshot](../artifacts/2026-10-15T19-32-51-528Z-browser-exploration/viewer-cache-after-revocation.png). |
| PROD-002 | A previously issued view URL returns 200 immediately after its public grant is revoked; fresh URL issuance returns 410. | Expected residual risk of independently signed URLs. README documents five-minute URLs; not filed as a defect. Expiry itself was not waited for. Already downloaded bytes cannot be recalled. | Latest follow-up `FOLLOW-05`, [execution JSON](../artifacts/2026-10-15T19-55-41-346Z-follow-up/execution.json). |
| PROD-003 | Abandoned intents have no automatic GC; logout does not revoke a seven-day token server-side. | Explicit MVP limitations from `virtual-data-room/README.md:93-95`; no defect added solely for these omissions. Physical orphan cleanup was not verified. | Source/discovery evidence only; external testing covered metadata cleanup and invalid-token handling, not token revocation/GC. |

## Requirement gaps

| ID | Decision needed |
|---|---|
| GAP-001 | Must email ownership be proved before a USER grant can authorize an account? Are grants to unregistered addresses intended? H01 cannot be tested using only the two existing accounts. |
| GAP-002 | Define metadata refresh and byte-access expectations after revoke, including already-open pages and pre-issued URLs. Overlapping independent grants correctly preserve access and should remain distinct from revocation failure. |
| GAP-003 | Define actual-content MIME/size enforcement at the bucket/completion boundary. DTO limits were tested; a small declared/actual size mismatch used the actual size on completion. Oversized object acceptance and PDF-content sniffing were not tested. |
| GAP-004 | Specify accessibility target and failed-preview confirmation policy. No WCAG conformance level or explicit outage fallback was supplied. |

## Unverified risks and blocked scenarios

| Discovery ID | Executed / observed | Not verified and reason |
|---|---|---|
| H01 | Read-only discovery prerequisites reviewed. | **Blocked:** no authorized unused mailbox/account; no new permanent accounts created. |
| H02 | Owner/other-user isolation; inherited Viewer reads; ancestor/sibling denial; nine mutation denials; share management denial; foreign folder bindings; file move and direct-grant persistence. | No third account was available; no arbitrary IDs or other users' resources were probed. Checked routes/data do not establish universal authorization coverage. |
| H03 | Sequential repeated USER/PUBLIC_LINK creation reused the active record. | **Blocked:** concurrent duplicate-grant experiment not authorized on shared infrastructure. |
| H04 | Sequential case-insensitive conflicts, upload suffixes, rename/move and pagination passed. | **Blocked:** concurrent name-race experiment not authorized. Normal two-file browser upload was a functional flow, not a race experiment. |
| H05 | **Confirmed BUG-001**, two independent controlled browser reproductions. | The completion failure was simulated client-side; actual backend/network outage incidence was not measured. |
| H06 | Zero/over-limit declared size and unsupported MIME rejected; harmless declared size 1 / actual small PDF reconciled to actual bytes. | **Blocked:** no oversized storage/content-policy experiment or privileged bucket inspection; actual ceiling and content enforcement remain unknown. |
| H07 | All tracked assessment roots deleted; API file absence and normal recursive metadata deletion checked. | **Blocked:** no DB/bucket access, rollback injection, cleanup-failure injection or deletion race. HTTP 204 does not prove object reclamation. |
| H08 | Fresh USER requests 404; revoked public requests 410; overlapping grants, cached display and immediate old-URL reuse observed. | Five-minute expiry enforcement and long-lived/multitab behavior not established. |
| H09 | **Confirmed BUG-003**, two controlled preview-error reproductions; normal preview/deletion passed. | Real infrastructure failure was not induced. |
| H10 | Blank folder names rejected by API and UI. | **Blocked:** registration/data-room whitespace API checks would create unnecessary permanent accounts/rooms with no supported deletion endpoint. |

Six explicitly blocked checks are listed in the final API execution JSON: H01, H03-RACE, H04-RACE, H06-CEILING, H07-INFRA, H10-PERSISTENT. Other coverage limits above are not silently counted as executed checks or confirmed defects.

The tables above retain their original exploratory scope. Later checks extended H06/H08 with small content/size probes, open/multiple browser tabs and fresh revocation. See [automation history](automation-execution.md) for current results; historical “not tested” statements are not the current coverage summary. Whole-Data-Room sharing remains a requirement coverage gap pending a dedicated empty room. H01 remains unreproduced.
