# AI Usage

## My Approach and Decisions

I organized this assignment as a staged, risk-based assessment. I prioritized authorization, confidential sharing, document integrity and destructive operations. I requested technical discovery before automation so the checks would reflect the actual product and API.

I chose Playwright and Codex for much of the practical testing. I reviewed intermediate reports and directed the next stage. I selected valuable API checks and a small set of browser journeys rather than aiming for a large test count. I also requested reuse of the exploratory utilities and the addition of GitHub Actions for repeatable execution. I handled GitHub authentication and secret entry myself. These were direction and scope decisions, not personal execution of every test.

## How I Used AI

The assignment explicitly allowed and encouraged AI use. I used ChatGPT and Codex substantially: to interpret requirements, explore the read-only application source, identify risks, prepare and execute exploratory Playwright checks, build reusable automation, analyze evidence and draft documentation. AI also assisted with CI configuration and local validation. Detailed scenarios, implementation choices and release reasoning were developed collaboratively, not solely by me.

AI assistance included correcting test-script and reporting problems. The application was not modified, and assertions were not weakened to make defects pass. Configuring CI is separate from proving a successful remote execution; the current status is recorded in the [CI document](ci-execution.md).

## How Results Were Evaluated

Potential problems were not automatically treated as confirmed bugs. Findings needed executed checks and supporting responses, UI observations or screenshots. Script/setup failures were separated from product defects. Selected totals were checked against saved JSON, including actual versus expected status.

Expected failures confirm known defects; they are not successful product behavior. Overlapping checks were not added as unique coverage. Blocked scenarios stayed visible as risks. H01 was not reproduced and remains unverified.

Evidence analysis was automated or AI-assisted. My review of intermediate reports does not imply independent human verification of every result, a full security audit or human release approval. Conclusions are limited to the available evidence.

## What I Learned / Key Takeaways

The assessment shows why normal flows alone are insufficient for confidential documents. Fresh access denial does not remove cached metadata or issued URLs. A successful byte transfer does not guarantee upload recovery. A small API-heavy suite can cover important rules while browser tests check the user experience. Shared-environment limits also matter: without disposable identities or storage access, some questions must remain open rather than be reported as safe.
