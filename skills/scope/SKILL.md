---
name: scope
description: "Show the user what a feature will look like before building it: restate the goal, mock the UI as real variants in the running app, iterate until the user approves, file the approved scope as an issue, then hand it to /buildit. Use for /scope, \"mock it up first\", \"show me before you build\", or a UI change that needs sign-off before work starts."
disable-model-invocation: true
---

# Scope

**Nothing gets built until the user has seen it and said yes.** A mock is cheaper to change than a PR, and an approved picture is the clearest brief `/buildit` can get. This skill ends at an approved, filed issue, then hands it to [`/buildit`](../buildit/SKILL.md).

## 1. Play back the goal

In 2 to 4 lines, say what you think the user wants and what problem it solves. Name your assumptions. Ask only the questions whose answers would change the mock; leave everything else to the variants. Read the code the change touches before you mock, so every variant can actually be built with the data and components the app has.

If nothing the user sees changes, skip step 2: approve the written scope in step 3 and go on.

## 2. Mock it in the real app

Follow the UI branch of the **prototype** skill (`~/.agents/skills/prototype/UI.md`): variants on the host page, switched by `?variant=`, using the app's real layout, components, and data. A mock in the real app shows problems a standalone sketch hides, and it shows only what can be built.

- **2 or 3 variants that really differ** (layout, information hierarchy, interaction), not three shades of one idea. One variant is fine when the user already described the design exactly. For a single small piece of UI (a button, a toast, a card), the **emil-prototype** skill fits better.
- Capture each variant per [`../buildit/references/proof.md`](../buildit/references/proof.md) (Capture steps 1, 2, 6, and 8): its main state and the edge case most likely to break it, such as empty, long content, or a narrow viewport. Mock interactions get a short video.
- Use `html_preview` and `html_render` only when the app can't run locally, and say that the mock isn't in the real app.
- Keep the mock out of trunk: do it in a worktree or on a `prototype/<slug>` branch.

**Reply:** each variant's screenshots embedded in the thread, one line per variant on what it trades off, your pick and why, and the preview URL for clicking through it. Then stop and wait.

## 3. Get approval

Approval is explicit, such as "go", "approved", "ship B", or a variant picked with changes the user describes. Anything else is feedback: change the mock, capture again, and show only what changed. Never file or build on silence, on a hint, or on "looks interesting."

Before you file, confirm the details in one message: the approved variant, the behavior, the acceptance criteria, and what is out of scope.

## 4. File the issue

Use the repo's issue tracker, per `docs/agents/issue-tracker.md` or the repo's AGENTS.md, which name the tracker and team. If the repo names no tracker, ask the user where to file.

- **Title:** the change as the user would say it.
- **Body:** the problem in the user's words; the approved design, with screenshots embedded (for Linear, upload with `prepare_file_upload` and embed the returned Markdown); the behavior; the **acceptance criteria**, written as checks a person can run against the app; out of scope; the variants not chosen and why, in one line each; and a link to the pushed `prototype/<slug>` branch.
- Set the issue to the tracker's ready-for-work state (such as `Todo`) and assign it to the user.

Push the prototype branch so the issue's link resolves, then report the issue's identifier and URL.

## 5. Hand off to buildit

Run [`/buildit`](../buildit/SKILL.md) in this thread with the issue as its brief. Name the branch and PR after the issue, following the repo's convention (such as `<user>/<team>-<n>` for the branch and `<TEAM>-<n>` in the PR title). Build the real feature from trunk. You may lift code from the winning variant, but the `?variant=` switch and the losing variants never ship. The proof for the PR shows each acceptance criterion holding and matches the approved screenshots; when it doesn't match, say so in the PR.

If the user says to file but not build ("just file it", "I'll pick it up later"), stop after step 4.
