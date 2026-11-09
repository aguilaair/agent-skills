---
name: release-kit
description: "Keep feature videos ready for the next Terradot announcement (prep, scheduled), announce a pinned release with its changelog, bento image and training videos (ship), then deploy it to prod after the feedback wait (deploy)."
disable-model-invocation: true
---

# Release kit

Three modes over one **window**, for a release that is announced before it reaches prod:

- `prep` runs on a schedule and drafts the feature videos the window is missing.
- `ship` runs by hand when the user wants to announce. It pins the release to one main commit, writes the changelog and bento image up to that commit, and, once the user says go, opens the held deploy PR and posts the release with its training videos to Slack.
- `deploy` runs by hand after people have had time to react. It gathers the feedback from the thread and, once the user says go, merges the deploy PR, so prod gets exactly the announced commit.

Nothing outside `ship`'s and `deploy`'s go steps posts, comments, opens or merges anything.

Prod releases are held for a human: the repository variable `PROD_AUTO_DEPLOY` is `false`, and `open-prod-deploy-pr.yml` takes a `sha` to pin (`docs/ci.md`, "prod"). `main` keeps moving while the deploy PR waits.

This skill orchestrates two others and leaves them unchanged: `feature-video` makes each video and `release-announcement` makes the changelog and image. Follow each of them in full where it is named. Work in the monorepo's primary checkout (`git worktree list`, first line) and run `git fetch origin main prod` first.

## The window

The window is every PR merged to main since the last announcement. That is also the range `release-announcement` uses, so the videos and the changelog cover the same PRs.

1. Find the last announcement with the 1mcp Slack server: `slack_search_public` with filters `from:<current user> in:#software`, sorted by timestamp. It is the newest message that lists changes under area headings (it opens with a `#` title such as "Platform release", or with `Hello @channel`, `hi @channel` or "New since the last update"). Note its time `T`.
2. The base is the commit that announcement released: `sha` in the `release.json` of its ship bundle (the bundle whose `ts` matches the post). An announcement older than `release.json` has none. Its base is the last prod merge before `T` (`git log --first-parent --format='%H %cI %s' --before=<T> -1 origin/prod`), taken as `<merge>^2`, the release branch it merged.
3. The window is `git log --first-parent --format='%H %cI %s' <base>..origin/main`. Each commit is one squash-merged PR, with `(#N)` in its subject.

Announcements come irregularly, one to three weeks apart. The window resets when a new announcement is posted, whether or not its deploy has merged yet, because its PRs have been announced.

## Demos

A **demo** is one feature video, and it covers one or more PRs. Group kept PRs into one demo when ops would learn them as one workflow: the same role on the same screens, where each PR adds a step to the others. A stack is the usual case, and so are follow-ups that build on a PR earlier in the window. Example: edit a vendor (#4928), add a vendor (#4935), and link questionnaires to vendors from the farm Suppliers view, which reuses the add dialog (#4949). Together those make one "vendors" demo. PRs for different roles, or for screens that one walkthrough does not connect, each get a demo of their own.

A demo is named by a slug, and its PRs move together: they share one project, one pair of MP4s, one ops post and one status. The demo's age is its oldest PR's merge. It is filmed at its newest PR's merge commit, and its "before" screens come from the parent of its oldest PR's merge.

A demo grows while its feature is being iterated on. Vendors started as editing (#4928), then gained adding (#4935), then linking questionnaires from the farm Suppliers view (#4949). A video filmed after the first PR would already be out of date. So a newly merged PR joins any demo it extends that has not shipped, even one that is already drafted or approved, and that demo is **re-recorded**:
- Delete its `out/`, `shots/` and `ops-post.md`. Keep `video.json` and the capture script as a starting point.
- Set every entry of the demo to `waiting`, with the reason `grew: #<N> joined`.
- The next draft writes one change card for all of its PRs and films at the new newest merge.

An announced or shipped demo stays as it is, because its videos are already out. A PR that extends it starts a new demo.

## The ledger

`~/release-kit/ledger.json` is the single record across runs, keyed by PR number:

```json
{"4949": {"title": "…", "mergeCommit": "<sha>", "mergedAt": "<iso>",
          "status": "skipped|waiting|has-video|drafted|failed|stuck|approved|dropped|announced|shipped",
          "reason": "one line: why it was skipped, or what failed",
          "demo": "<slug>", "postMerge": true, "project": "~/release-kit/videos/4928-<slug>",
          "videos": ["…-en.mp4", "…-pt.mp4"], "announcedIn": "2026-11-18", "shippedIn": "2026-11-19"}}
```

`waiting` is a kept PR whose demo has not been drafted yet, or must be re-recorded because it grew. Every kept entry carries its `demo`, and the entries of one demo hold the same `status`, `project` and `videos`.

Videos live in `~/release-kit/videos/<oldest pr>-<slug>/`, which is a `feature-video` project, and the finished files go in its `out/`. Ship bundles live in `~/release-kit/ship/<date>/`. Create these directories when they are missing.

Each ship bundle's `release.json` records its release, written by `ship` and completed by `deploy`:

```json
{"sha": "<pinned main commit>", "deployPr": 4991, "channel": "C06KCUY4WKZ", "ts": "<post ts>",
 "postedAt": "<iso>", "deployedAt": "<iso>"}
```

## prep

1. **Compute the window.** Each PR in it that the ledger lacks is a new entry. Also take entries marked `waiting` or `failed`.
2. **Sort the new PRs.** Only a `feat` PR can need a video. Read it with `gh pr view N --json title,body,files,comments` and keep it only if it changes an ops workflow, as `feature-video` defines one (a role does different steps on a screen). Mark the rest `skipped` with a reason: backend only, no ops workflow, Screenshots section says N/A, and so on.
3. **Group the kept PRs into demos.** Apply the rule in [Demos](#demos) across every kept PR in the window, the new ones and those already in the ledger. A new PR can join any demo that has not been announced. When it joins a drafted or approved demo, re-record that demo as [Demos](#demos) describes. Done when every kept entry has a `demo`.
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
     - For a change, the "before" screens come from the parent of the demo's oldest merge (`git show <oldest mergeCommit>^:<path> > <path>`, for each path any of its PRs changed), not from main and not from prod. Both have moved past the demo's PRs, so neither one is "before".
     - These videos are the training videos: the change has merged when they arrive, and they go out with the announcement, before the release reaches prod. The end card reads "Questions? Ask in #software." ("Dúvidas? Pergunte no #software."), with no line about training a team, and the ops post presents the video as the way to learn the feature.
     - Give the title card the demo's `area`, the changelog section its PRs will sit in, and a `motif` built from the screen the demo is about, as `feature-video` describes. The thread replies use the same area emoji.
     - Say "QA" as the English letters in both films: put `"QA": "Q-A"` in `lexicon.en` and `"QA": "quiú ei"` in `lexicon.pt`. Bare "QA" comes out as "kah", and "quê á" spells out the Portuguese letter names, which is not how the team says it.
     - Review the read-backs and both stills sheets yourself, to that skill's bar. The user's checks (listening to the PT film, approving the ops post) happen at ship.
     - Set `postMerge: true`, so ship knows the video came after the merge.
     - Then stop the dev servers, run `just worktree-remove release-kit/pr-<oldest N>` and `git branch -D release-kit/pr-<oldest N>`. The demo's entries are then marked `drafted`.
     - When a step fails, clean up the worktree and report the reason. The demo is marked `failed`, and `stuck` on a second failure. Prep stops retrying stuck demos, and the report names them.
6. **Report.** Done when every window PR has a ledger status. End with a short summary: the window (`since <date of T>`), each demo this run drafted with its PRs and MP4 paths, what it skipped and why, and the demos that are waiting, failed or stuck, each with its PRs. When there is nothing new, say so in one line.

## ship

1. **Refresh.** Run prep steps 1–4, so the ledger covers PRs merged since the last prep run. If any demo is still `waiting`, list it with its PRs and ask whether to draft it now (prep step 5, in as many batches as it takes) or ship without it.
2. **Pick the release commit.** It is the newest main commit a successful staging deploy covers: `gh run list --workflow migrate-build-deploy-staging.yml --branch main --status success --limit 1 --json headSha`, unless the user names an older one. Everything up to it is in this release. A PR merged after it waits for the next one, and a demo whose PRs are all after it stays as it is. Show the commit and the last PR it includes.
3. **Changelog.** Run `release-announcement`'s Changelog branch with the window's base and the release commit as its range. Tell it which PRs have a video (`has-video`, `drafted`) and which demo each belongs to, so their lines end with :movie_camera: and the PRs of one demo can share a line. Wait for the user to approve the text.
4. **Bento.** Run `release-announcement`'s Bento image branch on the approved text.
5. **Training posts.** For each demo with a PR in the changelog and a `drafted` or `has-video` status, show both MP4s and draft its two thread replies, one per language. Each reply carries one video:

   ````markdown
   ## :test_tube: Sample results
   **For:** lab ops · <@U…> <@U…>
   Read every lab's results batch by batch, with a QA badge on each batch, instead of in Hex.
   ````

   - The heading is the area's emoji and the feature's name as the film's title card says it. The PT reply uses the PT name and text, and keeps on-screen labels in English, as the films do.
   - **For:** names the role and tags the same people as the demo's changelog line.
   - One or two lines on what the person can now do. The video is the training, so the post does not repeat its steps.
   - When `postMerge` is unset, add a `>` quote saying the change is waiting for their OK before it merges.

   Ask the user to listen to each PT film once. Mark each demo `approved` or `dropped`. A drafted demo with no PR in the release stays as it is and waits for the next announcement.
6. **Bundle.** Done when `~/release-kit/ship/<date>/` holds `changelog.md`, `announcement.png`, `bento.html`, the approved MP4s, `posts.md` (each thread reply with its video file name, in posting order) and `PLAN.md`. `PLAN.md` lists every action in order:
   1. Pin the release commit as a held deploy PR into prod.
   2. Post the changelog as the parent message in #software.
   3. In its thread: the bento image, then each approved demo in changelog order, its EN reply then its PT reply.
7. **Pin and post.** Show `PLAN.md` and wait for the user to say go. A go covers this plan only.
   - **Check the hold.** `gh variable get PROD_AUTO_DEPLOY` must print `false`. Anything else would merge the deploy PR the moment it opens, so stop and tell the user.
   - **Clear the way.** `gh pr list --base prod --state open` must be empty, because the workflow opens nothing while a deploy PR is open. The weekday 14:00 UTC run opens one for whatever main held then, and with the hold it stays open. When one is open, show its commit and ask whether to close it (`gh pr close <n> --delete-branch`). It is the release only when its commit is the one picked in step 2.
   - **Pin.** `gh workflow run open-prod-deploy-pr.yml -f sha=<release commit>`. Wait for that run to finish, then find its PR with `gh pr list --base prod --state open --json number,headRefOid`. Done when the PR's head is the release commit. If the run fails, it says why (not on main, not covered by staging yet, a PR already open): stop and report it. Nothing has been posted yet.
   - **Post** with the 1mcp Slack server, in the plan's order:
     - Get #software's channel ID with `slack_search_channels`.
     - Post the changelog with `slack_send_message`, and keep its `ts` as the thread's parent.
     - Post each file as a thread reply with `<skill dir>/slack-upload.sh <file> <channel_id> <thread_ts> <reply.md>`. It gets an upload URL for the file's exact size, uploads it, and shares it in the thread with the reply's text.
     - Read the thread back with `slack_read_thread`. Done when every reply is in it with its file, in order. If a call fails partway, stop and report what is posted and what is not. Never re-post what is already there.
8. **Record.** Write `release.json` with the commit, the deploy PR, the channel, the post's `ts` and the time. Set `announcedIn: <date>` and `status: announced` on each approved entry. Give the user the post's link and the deploy PR's, and say that `deploy` is the next step once people have had time to react.

## deploy

1. **Find the release.** It is the newest ship bundle whose `release.json` has no `deployedAt`. Check that its deploy PR is still open and still headed by its `sha` (`gh pr view <n> --json state,headRefOid`). If it was merged or closed by hand, say so and stop.
2. **Gather the feedback.** Read the thread with `slack_read_thread`. List every reply that is not one of the training posts, with who wrote it and its link, in two groups:
   - **Holds the deploy:** a feature that is wrong, a request to wait, or something that would break someone's work.
   - **Follow-ups:** wording, ideas, questions that do not stop the release.

   Answer nothing in the thread. Show the list and ask whether to deploy.
3. **Pull a feature, when the user says so.** Revert its PR on main in a PR of its own. Close the deploy PR, then run ship steps 2 and 7's Pin with a new release commit that includes the revert. The new commit also takes in everything else merged since, so list those PRs, and post a reply in the thread saying what came out and what came in, after the user approves its text. Then update `release.json`.
4. **Deploy.** Once the user says go, merge the deploy PR as a merge commit, which `docs/ci.md` requires: `gh pr merge <n> --merge --delete-branch --match-head-commit <sha>`. Then find the prod deploy that the push to `prod` starts (`gh run list --workflow migrate-build-deploy-prod.yml --branch prod --limit 1`) and wait for it to finish. If it fails, report it with its log link and stop.
5. **Close out.** Set `deployedAt` in `release.json`, and `shippedIn: <date>` and `status: shipped` on each entry announced in it. Offer a short reply in the thread saying it is live; post it only after the user approves the text. The next prep run starts from the release commit.
6. **Clean up**, once the deploy has finished and the close-out is written. Done when only the record and the starting points remain:
   - In `~/release-kit/videos/`, delete `build/` (render intermediates, about 1-3 GB each) from every project whose entries are all `shipped`. Keep `out/`, `shots/`, `video.json` and the capture scripts.
   - Delete the scratch files this release wrote outside `~/release-kit/` (`/tmp` dumps, helper scripts, temporary worktrees).
   - Keep the newest `ledger.json.bak-*` and delete the older ones. Delete the bundle's `release.json.bak-*`.
   - Stop any DB tunnel or dev server this release started, once `lsof` shows it has no clients.
   - Keep `~/release-kit/ship/<date>/` whole. It is the release record, and prep reads the newest `release.json`.
