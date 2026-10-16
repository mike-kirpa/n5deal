# Automation execution — 2026-10-16T09-35-44-173Z-d36d51da

Runner: passed. Effective: passed.

Counts: {"passed":13}

Expected failures are known defects, not ordinary passes. Unexpected passes require review.

| Project | Test | Result | Cleanup |
|---|---|---|---|
| api | both documented accounts authenticate and resolve their own identity | passed | not-needed |
| api | invalid credentials return an actionable 401 | passed | not-needed |
| api | missing and invalid tokens cannot access protected assessment resources | passed | passed |
| api | nested folders retain hierarchy, validate names and delete recursively | passed | passed |
| api | pending files stay invisible and invalid declared uploads are rejected | passed | passed |
| api | PDF lifecycle preserves bytes, resolves conflicts, moves and deletes metadata | passed | passed |
| api | cursor pagination crosses the folder/file seam exactly once per item | passed | passed |
| api | folder grants inherit downwards without exposing ancestors or permitting writes | passed | passed |
| api | file mutation denial, overlapping grants and moves use current inheritance | passed | passed |
| api | public tokens are read-only subtree capabilities and fresh access stops on revoke | passed | passed |
| chromium | Owner logs in, creates a folder, uploads and opens a PDF, then downloads it | passed | passed |
| chromium | Owner shares in the UI; an independent Viewer context browses read-only descendants | passed | passed |
| chromium | Logout removes the session; switching to Viewer does not reuse Owner content or permissions | passed | passed |
