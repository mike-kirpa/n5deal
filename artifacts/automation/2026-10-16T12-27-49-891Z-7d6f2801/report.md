# Automation execution — 2026-10-16T12-27-49-891Z-7d6f2801

Runner: passed. Effective: passed.

Counts: {"passed":36}

Expected failures are known defects, not ordinary passes. Unexpected passes require review.

| Project | Test | Result | Cleanup |
|---|---|---|---|
| api | USER folder revocation denies all fresh file reads while an old signed URL is observed separately | passed | passed |
| api | file PUBLIC_LINK revocation rejects all token routes without revoking an independent USER grant | passed | passed |
| api | revoking a folder grant preserves direct file reads until the independent file grant is revoked | passed | passed |
| api | both documented accounts authenticate and resolve their own identity | passed | not-needed |
| api | invalid credentials return an actionable 401 | passed | not-needed |
| api | missing and invalid tokens cannot access protected assessment resources | passed | passed |
| api | upload intent size: 1 byte (metadata only) | passed | passed |
| api | upload intent size: 50 MiB minus 1 | passed | passed |
| api | upload intent size: exactly 50 MiB | passed | passed |
| api | upload intent size: negative | passed | passed |
| api | upload intent size: fractional | passed | passed |
| api | upload intent size: non-numeric | passed | passed |
| api | upload intent rejects image/png | passed | passed |
| api | upload intent rejects missing MIME | passed | passed |
| api | characterize non-PDF filename extension separately from declared PDF MIME | passed | passed |
| api | characterize actual content: non-PDF bytes with PDF name and MIME | passed | passed |
| api | characterize actual content: corrupted PDF with PDF name and MIME | passed | passed |
| api | completion records actual small PDF size when declared size differs by -11 | passed | passed |
| api | completion records actual small PDF size when declared size differs by 11 | passed | passed |
| api | nested folders retain hierarchy, validate names and delete recursively | passed | passed |
| api | pending files stay invisible and invalid declared uploads are rejected | passed | passed |
| api | PDF lifecycle preserves bytes, resolves conflicts, moves and deletes metadata | passed | passed |
| api | cursor pagination crosses the folder/file seam exactly once per item | passed | passed |
| api | folder grants inherit downwards without exposing ancestors or permitting writes | passed | passed |
| api | file mutation denial, overlapping grants and moves use current inheritance | passed | passed |
| api | public tokens are read-only subtree capabilities and fresh access stops on revoke | passed | passed |
| chromium | an opened PDF is observed after direct USER revocation; fresh download and reload are denied | passed | passed |
| chromium | folder and PDF tabs distinguish cached content from fresh access after inherited revocation | passed | passed |
| chromium | a download URL authorized before revocation can finish under a client-local response delay; the next request is denied | passed | passed |
| chromium | browser rejects declared text/plain before upload intent | passed | passed |
| chromium | browser rejects declared image/png before upload intent | passed | passed |
| chromium | browser falls back to PDF extension when file MIME is empty | passed | passed |
| chromium | characterize browser extension policy with a valid PDF and declared PDF MIME | passed | passed |
| chromium | Owner logs in, creates a folder, uploads and opens a PDF, then downloads it | passed | passed |
| chromium | Owner shares in the UI; an independent Viewer context browses read-only descendants | passed | passed |
| chromium | Logout removes the session; switching to Viewer does not reuse Owner content or permissions | passed | passed |
