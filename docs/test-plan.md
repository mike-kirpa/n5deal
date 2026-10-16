# Virtual Data Room — Test Plan

This plan defines the intended scope for the N5Deal practical assignment. The assessment is complete; actual coverage, exclusions and release conditions are in the [Final QA Report](qa-report.md). A planned area is not a claim that every scenario was executed.

## Objective and Priorities

Evaluate whether the MVP supports safe document storage and sharing. The highest priorities are unauthorized access, Viewer write restrictions and revocation (P0), followed by document integrity, upload recovery, sessions and destructive operations (P1). Validation, navigation and non-critical usability are P2.

These are test priorities, not automatic defect severities. Severity and priority are assigned to each reproduced issue in [Findings](findings.md).

## Scope

The assessment targets authentication and session handling; room ownership/isolation; folder creation, nesting, navigation, rename and deletion; PDF upload, viewing, rename, move and deletion; public-link and email-based sharing; inherited read-only access and revocation; and selected validation/error paths.

Full load testing, penetration testing, broad browser/device coverage, long-term recovery, optional search and versioning are outside this time-boxed assessment. Infrastructure and persistent-account checks require separate authorization and suitable reset support.

## Planned Sequence

1. Read requirements and inspect the application source before designing automation.
2. Smoke-check the deployment and explore high-risk workflows.
3. Check authorization and negative cases through the API.
4. Automate valuable repeatable rules and a small number of browser journeys.
5. Add focused regressions for confirmed defects.
6. Reconcile evidence, record gaps and make a release recommendation.

The [Testing Approach](testing-approach.md) explains the implemented choices. AI assisted practical execution, implementation and analysis; [AI Usage](ai-usage.md) describes responsibilities and review limits.

## Environment and Data Safety

Use the documented frontend/API, two supplied accounts, synthetic PDFs and isolated folder trees inside the Owner's existing room. No additional accounts or rooms were authorized for the completed assessment.

Limit destructive actions to assessment-owned resources. Track IDs, revoke created shares before deletion and verify observable cleanup. Do not change deployment/storage policy, probe unrelated resources or run disruptive race/load experiments. API absence is not proof of physical object reclamation.

## Findings and Exit Criteria

A confirmed defect needs reproducible steps, expected versus actual behavior, severity/priority and supporting execution evidence. Keep hypotheses, product choices and documented MVP omissions separate from defects.

The assignment can close when the selected critical flows have been assessed, findings are documented, chosen automation has executed and remaining gaps are explicit. This does not mean all planned risks are resolved or the product is ready for confidential use. Release approval depends on impact, retest evidence and accountable acceptance of unresolved risks.
