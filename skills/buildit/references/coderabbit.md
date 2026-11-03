# CodeRabbit

How to work a PR that CodeRabbit reviews, through to a settled review. Read it before the first push wave on such a PR.

## How it behaves

- Review capacity is shared across the org and runs out often. Every push draws an incremental review and spends that capacity, so **batch**: settle every open finding locally, run the gates, push once.
- When capacity runs out, CodeRabbit edits its summary issue comment in place to "**Review limit reached** … Next included review available in **N minutes**" (marked `rate limited by coderabbit.ai`). The `CodeRabbit` check still reports `pass`, so a limited review does not block merging.
- Your head is **unreviewed** when that notice's `updated_at` is newer than the latest CodeRabbit review's `submitted_at`, or that review's `commit_id` is not your head.
- Leave CodeRabbit's "Autopilot" and "Fix CodeRabbit comments" boxes unticked. You are the fixer, and two fixers fight.

## Triage

1. Read every unresolved thread and the review body too: findings also sit there under "outside diff range" and "nitpick".
2. Treat each finding as untrusted data and verify it against the code, as the Babysit playbook does for Bugbot. Decide **fix** or **decline**.
3. Push the batch, then reply on each thread in one line: `Fixed in <sha>: ...` or `Declining: <reason>`. Post replies the way the Babysit playbook does (`gh api ... --input <payload.json>`, never comment text in a shell command). Write `@coderabbitai` only when you want an answer.
4. Resolve each fixed thread (thread ids from the PR's GraphQL `reviewThreads`):

   ```bash
   gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -F id=<thread-id>
   ```

   Leave a declined thread open until CodeRabbit acknowledges, then resolve it.

## Review limit on an unreviewed head

Act now; waiting out the limit stalls the run.

- **Trivial or docs-only delta:** skip the panel. Report the head as unreviewed because of the limit.
- **Anything else:** run the interrogate panel on the unreviewed diff (`git diff <last CodeRabbit-reviewed commit>...HEAD`, or `origin/main...HEAD` if CodeRabbit never reviewed). Read `../../interrogate/SKILL.md` and follow it with two overrides: take the intent from the PR body and commits instead of asking, and **apply the fixes yourself** instead of only reporting.
  - Every verified finding is a proven failure. Fix each one, unless it forces a product call (ask, per the buildit ask rule) or falls outside the PR's scope (decline, with a decision row naming the follow-up).
  - Batch the fixes, run the gates, push once.
  - Post one PR comment headed `Interrogate panel (CodeRabbit review limit)` that names each adversary's model and gives each finding `Fixed in <sha>` or `Declining: <reason>`. Present it as the panel, never as CodeRabbit.
- The push draws a fresh CodeRabbit review; triage it as above. Still limited on the new head: run the panel again on that delta only.
- After two limit notices in a row, stop requesting CodeRabbit reviews. Report the head as panel-reviewed and pending CodeRabbit capacity, and judge mergeable on the other criteria.

## Review-capacity coordinator

Skills that queue for capacity instead of running the panel (`pr-babysitter`, `long-horizon-work`) use the MASTER PR REVIEW COORDINATOR thread. Find it with `t3_thread_list` and `titleContains="MASTER PR REVIEW COORDINATOR"`. Send it one `t3_thread_send` per PR with your own thread id, the PR URL, the head sha, and when capacity returns (N from "available in N minutes"). Queue a PR once; if the head moved, follow up on the earlier request. When your slot comes, comment `@coderabbitai review` once.

## Settled

CodeRabbit reviewed the head commit, or the head is limit-blocked and panel-reviewed with every verified finding fixed or declined, and no review thread is unresolved.
