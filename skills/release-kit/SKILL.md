---
name: release-kit
description: "Keep feature videos ready for the next Terradot announcement (prep, scheduled), then bundle the changelog, bento image and videos to post together (ship)."
disable-model-invocation: true
---

# Release kit

Two modes over one **window**. `prep` runs on a schedule and drafts the feature videos the window is missing. `ship` runs by hand when the user wants to announce. It writes the changelog and bento image, bundles them with the approved videos, and posts the release to Slack once the user says go. Nothing else in either mode posts, comments or attaches anything anywhere.

This skill orchestrates two others and leaves them unchanged: `feature-video` makes each video and `release-announcement` makes the changelog and image. Follow each of them in full where it is named. Work in the monorepo's primary checkout (`git worktree list`, first line) and run `git fetch origin main prod` first.

## The window

The window is every PR merged to main since the last announcement. That is also the range `release-announcement` uses, so the videos and the changelog cover the same PRs.

1. Find the last announcement with the 1mcp Slack server: `slack_search_public` with filters `from:<current user> in:#software`, sorted by timestamp. It is the newest message that lists changes under area headings (it opens with a `#` title such as "Platform release", or with `Hello @channel`, `hi @channel` or "New since the last update"). Note its time `T`.
2. The base is the last prod merge before `T`: `git log --first-parent --format='%H %cI %s' --before=<T> -1 origin/prod`. Prod deploy merges come from `release/YYYY-MM-DD-N` branches.
3. The window is `git log --first-parent --format='%H %cI %s' <base>^2..origin/main`. Each commit is one squash-merged PR, with `(#N)` in its subject.

Announcements come irregularly, one to three weeks apart, with several prod deploys between them. The window resets only when a new announcement shows up in Slack.

## Demos

A **demo** is one feature video, and it covers one or more PRs. Group kept PRs into one demo when ops would learn them as one workflow: the same role on the same screens, where each PR adds a step to the others. A stack is the usual case, and so are follow-ups that build on a PR earlier in the window. Example: edit a vendor (#4928), add a vendor (#4935), and link questionnaires to vendors from the farm Suppliers view, which reuses the add dialog (#4949). Together those make one "vendors" demo. PRs for different roles, or for screens that one walkthrough does not connect, each get a demo of their own.

A demo is named by a slug, and its PRs move together: they share one project, one pair of MP4s, one ops post and one status. The demo's age is its oldest PR's merge. It is filmed at its newest PR's merge commit, and its "before" screens come from the parent of its oldest PR's merge.

A demo grows while its feature is being iterated on. Vendors started as editing (#4928), then gained adding (#4935), then linking questionnaires from the farm Suppliers view (#4949). A video filmed after the first PR would already be out of date. So a newly merged PR joins any demo it extends that has not shipped, even one that is already drafted or approved, and that demo is **re-recorded**:
- Delete its `out/`, `shots/` and `ops-post.md`. Keep `video.json` and the capture script as a starting point.
- Set every entry of the demo to `waiting`, with the reason `grew: #<N> joined`.
- The next draft writes one change card for all of its PRs and films at the new newest merge.

A shipped demo stays as it is. A PR that extends it starts a new demo.

## The ledger

`~/release-kit/ledger.json` is the single record across runs, keyed by PR number:

```json
{"4949": {"title": "…", "mergeCommit": "<sha>", "mergedAt": "<iso>",
          "status": "skipped|waiting|has-video|drafted|failed|stuck|approved|dropped|shipped",
          "reason": "one line: why it was skipped, or what failed",
          "demo": "<slug>", "postMerge": true, "project": "~/release-kit/videos/4928-<slug>",
          "videos": ["…-en.mp4", "…-pt.mp4"], "shippedIn": "2026-11-18"}}
```

`waiting` is a kept PR whose demo has not been drafted yet, or must be re-recorded because it grew. Every kept entry carries its `demo`, and the entries of one demo hold the same `status`, `project` and `videos`.

Videos live in `~/release-kit/videos/<oldest pr>-<slug>/`, which is a `feature-video` project, and the finished files go in its `out/`. Ship bundles live in `~/release-kit/ship/<date>/`. Create these directories when they are missing.

## prep

1. **Compute the window.** Each PR in it that the ledger lacks is a new entry. Also take entries marked `waiting` or `failed`.
2. **Sort the new PRs.** Only a `feat` PR can need a video. Read it with `gh pr view N --json title,body,files,comments` and keep it only if it changes an ops workflow, as `feature-video` defines one (a role does different steps on a screen). Mark the rest `skipped` with a reason: backend only, no ops workflow, Screenshots section says N/A, and so on.
3. **Group the kept PRs into demos.** Apply the rule in [Demos](#demos) across every kept PR in the window, the new ones and those already in the ledger. A new PR can join any demo that has not shipped. When it joins a drafted or approved demo, re-record that demo as [Demos](#demos) describes. Done when every kept entry has a `demo`.
4. **Find the videos that already exist.** Under the pre-merge rule, a PR is filmed and signed off by ops before it merges to main. When a kept PR's body or comments already carry its feature video (EN and PT MP4s, as `feature-video` renders them), mark its demo `has-video` and record the links. A silent QA flow recording from the Screenshots section is not a feature video. Mark the remaining demos `waiting`.
5. **Draft the gaps, oldest demo first, as many at once as the machine holds.**
   - **Batch size.** Each demo in flight runs its own worktree, with a Postgres container, the API and the web dev server, and then Chrome workers for capture and render. Budget 4 CPU cores and 6 GB of free memory per demo, and run `min(cores ÷ 4, free GB ÷ 6, 4)` demos at once. Read cores from `sysctl -n hw.ncpu`, and free memory from `hw.memsize` × the free percentage in `memory_pressure`. A 14-core, 48 GB Mac fits 3. A run drafts one batch, and the rest wait for the next run.
   - **One subagent per demo.** Run the batch in parallel, one subagent per demo.
     - The brief names the demo's slug, PRs, oldest and newest merge commits, project dir and shape. It points at this step and `feature-video`, and repeats the done-when below.
     - Subagents write only inside their own worktree and project dir. They never edit the ledger, post anything or touch another worktree.
     - Each subagent's final report gives its MP4 paths, what it checked, the read-back words it accepted, the data it seeded, and any failure.
     - When the batch is back, check that every worktree and branch is gone. Pull a few frames from each PT film yourself. Then write all the statuses to the ledger in one write, so parallel runs never overwrite each other.
   - **Each demo** runs `feature-video` from the change card to the render, with these changes:
     - Write one change card for the whole demo. It covers every PR in the demo as one walkthrough, and its steps follow the order a person takes them, which can differ from the merge order.
     - Pick the demo's shape from the change card:
       - **A change** to work ops already do in the platform keeps `feature-video`'s shape: Before, Now, Watch out.
       - **A launch** is a page or workflow that is new to the platform, even when the work used to live in a spreadsheet. Its video is about the feature itself: the hook, a "How it works" chapter ("Como funciona") that walks the feature one action per line, then Watch out. It has no Before chapter and its lines do not open with "Now". Its change card skips **before**.
     - Film in a worktree of its own at the demo's newest merge commit: `TERRADOT_WORKTREE_INSTALL=1 wt switch -y --create release-kit/pr-<oldest N> --base <newest mergeCommit>`.
       - If `wt` reports a bootstrap failure, run `just worktree-doctor`, then `just worktree-init --install` if dependencies or migrations are missing.
       - Then run `feature-video`'s `fv.sh dev-user` on the worktree.
       - Its database can be older than prod. Before inventing fixtures, run `fv.sh relink`, then set only the state the walkthrough needs with `fv.sh db`.
     - For a change, the "before" screens come from the parent of the demo's oldest merge (`git show <oldest mergeCommit>^:<path> > <path>`, for each path any of its PRs changed), not from main and not from prod. Prod catches up with main within hours, so neither one is "before".
     - These videos are the training videos, because the change is already live when they arrive. The end card reads "Questions? Ask in #software." ("Dúvidas? Pergunte no #software."), with no line about training a team, and the ops post presents the video as the way to learn the feature.
     - Give the title card the demo's `area`, the changelog section its PRs will sit in, and a `motif` built from the screen the demo is about, as `feature-video` describes. The thread replies use the same area emoji.
     - Say "QA" as the English letters in both films: put `"QA": "Q-A"` in `lexicon.en` and `"QA": "quiú ei"` in `lexicon.pt`. Bare "QA" comes out as "kah", and "quê á" spells out the Portuguese letter names, which is not how the team says it.
     - Review the read-backs and both stills sheets yourself, to that skill's bar. The user's checks (listening to the PT film, approving the ops post) happen at ship.
     - Set `postMerge: true`, so ship knows the video came after the merge.
     - Then stop the dev servers, run `just worktree-remove release-kit/pr-<oldest N>` and `git branch -D release-kit/pr-<oldest N>`. The demo's entries are then marked `drafted`.
     - When a step fails, clean up the worktree and report the reason. The demo is marked `failed`, and `stuck` on a second failure. Prep stops retrying stuck demos, and the report names them.
6. **Report.** Done when every window PR has a ledger status. End with a short summary: the window (`since <date of T>`), each demo this run drafted with its PRs and MP4 paths, what it skipped and why, and the demos that are waiting, failed or stuck, each with its PRs. When there is nothing new, say so in one line.

## ship

1. **Refresh.** Run prep steps 1–4, so the ledger covers PRs merged since the last prep run. If any demo is still `waiting`, list it with its PRs and ask whether to draft it now (prep step 5, in as many batches as it takes) or ship without it.
2. **Changelog.** Run `release-announcement`'s Changelog branch. Tell it which PRs have a video (`has-video`, `drafted`) and which demo each belongs to, so their lines end with :movie_camera: and the PRs of one demo can share a line. Wait for the user to approve the text.
3. **Bento.** Run `release-announcement`'s Bento image branch on the approved text.
4. **Training posts.** For each demo with a PR in the changelog and a `drafted` or `has-video` status, show both MP4s and draft its two thread replies, one per language. Each reply carries one video:

   ````markdown
   ## :test_tube: Sample results
   **For:** lab ops · <@U…> <@U…>
   Read every lab's results batch by batch, with a QA badge on each batch, instead of in Hex.
   ````

   - The heading is the area's emoji and the feature's name as the film's title card says it. The PT reply uses the PT name and text, and keeps on-screen labels in English, as the films do.
   - **For:** names the role and tags the same people as the demo's changelog line.
   - One or two lines on what the person can now do. The video is the training, so the post does not repeat its steps.
   - When `postMerge` is unset, add a `>` quote saying the change is waiting for their OK before it merges.

   Ask the user to listen to each PT film once. Mark each demo `approved` or `dropped`. A drafted demo with no PR in the changelog's range stays as it is and waits for the next announcement.
5. **Bundle.** Done when `~/release-kit/ship/<date>/` holds `changelog.md`, `announcement.png`, `bento.html`, the approved MP4s, `posts.md` (each thread reply with its video file name, in posting order) and `PLAN.md`. `PLAN.md` lists every post in order, with its channel, its file and whether it goes in the thread:
   1. The changelog, as the parent message in #software.
   2. In its thread: the bento image, then each approved demo in changelog order, its EN reply then its PT reply.
6. **Post.** Show `PLAN.md` and wait for the user to say go. A go covers this plan only. Then post with the 1mcp Slack server, in the plan's order:
   - Get #software's channel ID with `slack_search_channels`.
   - Post the changelog with `slack_send_message`, and keep its `ts` as the thread's parent.
   - Post each file as a thread reply with `<skill dir>/slack-upload.sh <file> <channel_id> <thread_ts> <reply.md>`. It gets an upload URL for the file's exact size, uploads it, and shares it in the thread with the reply's text.
   - Read the thread back with `slack_read_thread`. Done when every reply is in it with its file, in order. If a call fails partway, stop and report what is posted and what is not. Never re-post what is already there.
7. **Close out.** Once the thread checks out, set `shippedIn: <date>` and `status: shipped` on each approved entry, and give the user the post's link. The next prep run finds the new post and starts a new window.
