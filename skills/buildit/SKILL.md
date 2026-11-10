---
name: buildit
description: "p3-mode carried to a mergeable PR: build, prove it on the real surface, open the PR with screenshots, then drive CodeRabbit and CI until it can merge. Use for /buildit, \"build this autonomously\", \"take it to a PR\", \"ship this end to end\", or a feature handed over expecting a mergeable PR back."
---

# Buildit

**p3-mode, with one exit: a mergeable PR.** Read `../p3-mode/SKILL.md` and follow it in full: principles, non-negotiables, routing, delegation, reply form. This file names only what changes.

## The run

This is an **Autonomous run** (`../p3-mode/playbooks/autonomous-run.md`) whose predicate is **mergeable**:

1. **Predicate first.** Given an issue (from `/scope` or the user), read it and its comments first. Given none, search the tracker for one, or file one per `../scope/SKILL.md` step 4 (project, milestone, requester, stakeholders, acceptance criteria with a must-not-break check; no prototype link) before you branch. Carry its identifier in the branch and the PR title, per the repo's convention (EPDS: `<user>/epds-<n>`, and `EPDS-<n>` in the PR title). Its acceptance criteria are what the proof must show, and its approved screenshots are the design to match. Reply in 2 to 4 lines: what you will build, your assumptions, and the predicate (below). Then start. Open a todolist that copies in the matched playbook's steps (the Feature playbook for new or changed behavior), then proof, PR, and review loop. A skipped step stays listed with `skip: <reason>`.
2. **Build** per the matched playbook. Each behavioral acceptance criterion gets a test that fails without the change, where the surface allows one (the **test-behavior-not-implementation** principle skill).
3. **Prove** a user-visible change per `references/proof.md`. Then get an independent verdict: one fresh `delegate_task` verifier on a different provider or model family from the author, per `../p3-mode/playbooks/shipping.md` step 1, runs each acceptance criterion on the real surface and returns `PASS`, `PASS+NOTES`, or `FAIL`. A `FAIL` sends the run back to Build. Skip the verifier only for a trivial or docs-only change, and say so in the reply.
4. **Open the PR** per the Opening a PR playbook, with the evidence from `references/proof.md`. After its sections, add `## Release note`, one sentence a user would read in the changelog (or `none`), and `## Stakeholders`, copied from the issue with the Slack IDs kept (or `none`). `release-announcement` reads both. `link_pull_request` it at once, every layer of a stack.
5. **Babysit in `drive` mode right after the PR (or the whole stack) opens.** This overrides Opening a PR's rule that a babysit waits for the user to ask: here the ask is the brief. Follow the Babysit playbook, and on a PR CodeRabbit reviews, `references/coderabbit.md` on top of it.

## Mergeable

All of these hold: gates green; the change proven on its real surface; the verifier's verdict `PASS` or `PASS+NOTES` on the head, or its skip reported; required checks green (`gh pr checks`); CodeRabbit settled per `references/coderabbit.md`; no unresolved review thread; `mergeable=MERGEABLE` and `mergeStateStatus` `CLEAN`, or `BLOCKED` only on a required human approval.

Stop there. Merging, pushing to trunk, and touching prod need the user's explicit word; a merge or ship request routes to the Shipping playbook.

## Asking

p3-mode's autonomy rules hold. Also pause for: money or invoice math, data migrations on real data, deleting a user-visible feature, prod or a shared trunk deployment, a credential or paid service, and scope growing past the brief. Ask in the thread with a few options, recommended first, and keep the work that does not depend on the answer moving. Log every other non-obvious call as a decision row the user can overrule in review.

## Providers

When a role's provider cannot run (out of funds, rate limited, provider error), fall back in this order: `opencode` / `opencode-go/deepseek-v4.1-flash`, then `cursor`, then `claudeAgent`. Hand the next one the same brief plus what the failed one left behind (worktree, branch, open PR), and say which provider did the work.

## Status and reply

One-line status at real transitions only: design settled, PR opened, CI red then fixed in `<sha>`, review limit hit and panel running, mergeable.

**Reply:** the predicate and its final state. What you built, the shape you chose, and the principle behind it. Your decisions and the calls left to the user. The proof: embedded screenshots, the video path, how to verify, and the verifier's verdict with its model. The PR link. Each CodeRabbit or panel finding and how it was handled, naming the panel's models. Anything waiting on a human. A `**POST-MERGE ACTIONS**` section when a follow-up PR or post-merge command must carry something.
