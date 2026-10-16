# Exploratory evidence — 2026-10-15

The final selected execution consists of these four runs:

| Folder | Command | Passed / failed / blocked |
|---|---|---|
| `2026-10-15T19-15-26-234Z-environment/` | `node scripts/exploratory/environment.cjs` | 6 / 0 / 0 |
| `2026-10-15T19-30-07-899Z-api-exploration/` | `node scripts/exploratory/api-exploration.cjs` | 29 / 1 / 6 |
| `2026-10-15T19-32-51-528Z-browser-exploration/` | `node scripts/exploratory/browser-exploration.cjs` | 19 / 3 / 0 |
| `2026-10-15T19-55-41-346Z-follow-up/` | `node scripts/exploratory/follow-up.cjs` | 7 / 0 / 0 |

Total: **61 passed, 4 failed, 6 blocked** (71 checks). Check IDs, durations and actual assertions are in each `execution.json`. HTTP records retain method, sanitized path, status and selected redacted payloads; browser console/page errors are kept in `consoleEvents`. A failed check is not automatically a distinct confirmed defect; see [findings](../docs/findings.md).

Earlier run folders remain as reproduction/debugging evidence. Their outcomes are separately accounted for in [the complete execution ledger](../docs/exploratory-report.md). In particular, initial locator/readiness failures and missing dependent fixtures are harness outcomes, not extra product bugs.

Useful evidence in the final browser folder:

- `retry-after-completion-failure.png`: BUG-001; one completion response was simulated locally, then real Retry PUT returned 400.
- `delete-enabled-after-preview-error.png`: BUG-003; preview 500 was simulated only in the browser.
- `folder-row-keyboard-navigation.png` plus `UI-08` JSON semantics: BUG-004.
- `viewer-cache-after-revocation.png` plus `UI-20`: cached display with fresh API 404; not an authorization bypass.
- `public-link-revoked.png`: revoked-link UI.
- `viewer-read-only-folder.png`: hidden owner actions for Viewer.

The final follow-up folder includes a fully painted native PDF preview, drag/drop result, zero-byte validation and session-check retry screen. The early main-browser PDF screenshot precedes plugin painting; it is not evidence of a PDF-rendering defect.

Credential/token/signed-URL fields and URL-bearing console/error strings are redacted. Synthetic file contents and owned QA resource UUIDs/names may remain. No passwords, auth-state files, JWTs, signed URLs, API keys, raw traces or HARs are intentionally retained. Screenshots show page content, not the browser address bar; no share-dialog token field was captured. The scripts read supplied credentials only in memory.

Every completed run passed its cleanup check: created grants were revoked before assessment roots were deleted. Bucket reclamation and DB internals were not inspected.
