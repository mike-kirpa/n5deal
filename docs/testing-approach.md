# Testing Approach

Start with the [QA report](qa-report.md) for the decision and [findings](findings.md) for reproducible defects.

## Priorities and Testing Pyramid

Confidentiality, permission boundaries, document integrity, recovery and destructive actions drove the scope. Source discovery separated requirements from implemented behavior and documented MVP omissions. Exploratory checks informed focused automation; AI assistance is disclosed in [AI Usage](ai-usage.md).

The reusable framework is API-heavy: authorization, inheritance, independent grants, metadata, PDF bytes, validation and fresh revocation are cheaper and clearer to verify directly than through repeated UI journeys. Browser checks cover real login, document operations, read-only sharing, account switching, Owner UI revocation and selected failure feedback.

Dependency-free Node unit tests protect the QA harness: redaction, result classification and the expiration oracle. Existing application unit tests were inspected, not newly executed or counted. This is the beginning of a testing pyramid, not a replacement application test suite.

## Three Execution Modes

- **Stable:** `npm test` selects API and browser contracts with defined expectations.
- **Known defects:** `npm run test:known-bugs` asserts correct behavior with narrowly placed expected-failure markers. Setup/cleanup failures cannot count as reproduced defects; unexpected passes require review.
- **Characterization:** `npm run test:characterization` observes unspecified extension/content policy. These four probes are excluded from stable totals and live CI. Acceptance of tiny non-PDF/corrupted content is not automatically a defect.

`npm run test:all` combines stable and known-defect projects only; `test:headed` selects stable projects. Raw `npx playwright test` selects all ordinary projects, including characterization. Results and earlier attempts remain in [automation history](automation-execution.md).

<a id="access-revocation-and-upload-validation-extension"></a>

## Security and Validation Boundaries

Fresh API authorization is distinct from cached UI and independently signed storage URLs. Tests check inherited/direct grants, public token scope, revocation, unsigned/tampered auth tokens, and missing/tampered/path-swapped storage tokens using only two newly created owned objects. Literal markup-name checks cover selected listing surfaces, not comprehensive XSS protection.

Size boundaries exercise intent metadata only: 0, 1, 50 MiB minus/at/plus one, negative, fractional and non-numeric values. The 1-byte intent is not a successful PDF upload. Small under/over-declared PDFs check completion's recorded size. MIME validation, filename policy and actual content are treated separately; no oversized storage upload is attempted.

The opt-in `npm run test:expiration` waits for issued expiry plus 30 seconds and requires a fresh Owner URL to return the same file's bytes. Provider/server failures and throttling are inconclusive, not expiry success. It remains outside normal/CI execution; `-- --list` only collects it.

## Data, Failure Injection and Evidence

Each test owns a unique subtree, tiny synthetic files and tracked grants. Separate Owner/Viewer/anonymous sessions stay in memory. Teardown revokes before deleting the owned root, then verifies tracked metadata absence; uncertainty fails cleanup and prevents blind deletion. Metadata 404 does not prove physical object removal or pending-row purge.

One worker, zero retries and response/locator waits keep runs auditable. Batch upload simulates failure before storage acceptance and holds completion to observe per-file progress; BUG-001 simulates failure after real storage acceptance. Neither is a backend outage. The failed-preview regression cancels rather than executing unsafe deletion.

Reports retain sanitized observations and selected bug screenshots, not credentials, auth state, raw trace/HAR/video/DOM dumps. Scanning supplements, not replaces, evidence review.

## Reproduction and Remaining Limits

Use [README setup](../README.md#quick-start) with environment credentials and downloaded Chromium. Optional `test:documented` reads the authorized sibling application README into child memory and defaults to installed Chrome; standalone execution does not require it. Without an optional ordinary public upload key, API PDF setup discovers the client header through a browser and tracks its cancelled probe intent. Never supply a privileged key.

Static CI validates types, unit tests and collection. Live CI is manual/default-branch-only with secrets, serialized execution and a cleanup gate; remote success is unverified.

H01 needs an approved disposable identity/reset. Whole-Data-Room USER/public sharing needs a dedicated empty room: sharing the existing room could expose baseline data. No rate-limit/load experiments, privileged bucket inspection, race tests or comprehensive cross-browser/accessibility/security assessment are claimed. Historical blocks remain explicit in the report.
