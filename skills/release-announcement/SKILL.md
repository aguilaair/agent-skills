---
name: release-announcement
description: "Terradot prod-deploy changelog for Slack, and its on-brand bento image. Use when asked for a changelog or release notes for a prod deploy (main vs prod, or since the last post), or for a bento / announcement image of platform updates."
---

# Release announcement

Two branches. A changelog request runs **Changelog**. An image request with the text already given runs **Bento image** on that text. A request for both runs them in order, and the image waits until the user has approved the text.

## Changelog

1. **Find the range.** The base is the last prod merge before the previous changelog post. Find that post with the 1mcp Slack server: run `slack_search_public` with `from:<current user> in:#software` and the date the user gives, or `after:` a few weeks back. Then list prod merges with `git log --first-parent --format='%h %ci %s' origin/prod`. Prod deploy PRs are titled `YYYY-MM-DD PROD DEPLOY N`. The head is the newest prod merge when the deploy has already shipped, and `origin/main` when the promotion PR is still open.
2. **List the commits.** Run `git log --first-parent --format=%s <base>^2..<head main commit>`, where `^2` is the main-side parent of a prod merge. Count commits by `type(scope)`. Drop `ci`, `docs`, `test`, `chore`, `refactor` and `build`. Also drop plumbing nobody sees (pg-sync, dbt, infra, alerts) unless it changes something a person notices.
3. **Read before you write.** For every item that makes the post, read its PR body with `gh pr view N --json title,body`. Titles undersell, and they skip things like gates, flags and backfills.
4. **Check that it's live.** Some PRs say a change waits on a Terraform apply, a flag, a test mode, or a stacked follow-up. Check what prod does wherever that's cheap (`curl -sI`, a status endpoint). Otherwise, word the line as "rolling out" or "coming soon" and flag it.
5. **Name the stakeholders.** Each line names the people its rollout was coordinated with: the ops lead who asked for it, signed off on it, or now runs the workflow. Propose them from the PR body and its Linear issue, and from the tags the last announcement gave the same area. Then ask the user to confirm the list. Look up each Slack ID with `slack_search_users`. A fix nobody has to act on carries no tag. When a tagged person needs a note of their own ("no workflow change on your side"), it goes after their tag.
6. **Write it in house style.** Slack renders standard Markdown, so the post uses headings, bullets and bold. Group it by stakeholder area (Lab ops, Finance, Logistics, Quarry QA, LCA, Everyone), not by code area. Put it in one `markdown` code block, ready to paste:

   ````markdown
   # :rocket: Platform release, <Mon D>

   Hello <!channel>! <one-line opener>. **<When it goes live, e.g. "Live by end of day US time">**, so there's time to flag anything.
   Training videos for the new workflows are in the thread :thread:

   ## :test_tube: Lab ops
   - **Sample results page:** read every lab's results batch by batch, no more Hex :movie_camera: <@U…> <@U…>
   - COC export no longer drops soil samples with negative ids

   > :warning: **Heads up:** a behaviour that changed under people's feet
   > :rotating_light: **Action required:** what someone must do, and by when
   ````

   - One `#` title for the post and one `##` heading per area, with the area's Slack emoji. Add the access scope in the heading when the area has one (`## :moneybag: Finance (erw:finance)`).
   - Each change is a `-` bullet. Bold only the name a person will look for on screen (a page, a tab, a button), then a colon. Stakeholder tags go at the end of the line.
   - Put Heads up and Action required lines in a `>` quote at the end of their area, not inside a bullet.
   - Mark a change that has a video in the thread with :movie_camera:, before its tags.
   - Most impactful area first, and the same inside each area. Write plain words over identifiers. Give a large separately-owned product (TerraScope) its own `##` section and flag it as optional in its heading.
   - No tables and no nested bullets. Each change stays one line a person can scan.
   - Write `<!channel>` and `<@U…>` as written here when the post goes out through the Slack tools. When the user pastes it by hand, write `@channel` and `@Name` instead.
7. **List what to check before posting.** After the block, list:
   - each claim you couldn't verify;
   - what you left out, and why;
   - follow-ups or backfills the PRs say are owed.

   Offer a full follow-up pass. Don't run it unasked.

## Bento image

The template `assets/bento.html` is a finished, approved example. Build each new image by editing a copy of it.

1. **Copy.** Run `cp -R <skill dir>/assets/. <scratch dir>/`, then edit `<scratch dir>/bento.html`.
2. **Tiles.** Write one `<section class="tile …">` per changelog section, using the user's final wording. Tighten a line only to make it fit, and keep its meaning. Give each tile a Slack-emoji icon (`.emo`) and at most one small visual that shows the feature: status pills, a mini mock of the page, a before → after, or a mini grid. Mock rows name roles ("Ops lead"), never real people. Add a corner sticker (`.tag.corner`: Fixed, Unstuck, New) where it's fun and true.
3. **Layout.** The page is a 12-column grid. In each row the spans add up to 12. The default shape: a hero (span 8) and a tile (span 4) on top, then a tall tile (span 7, `grid-row: span 2`) beside two span-5 tiles, then a bottom row such as 5/4/3. Change the spans when the number of sections changes. The hero counter must equal the number of tiles.
4. **Brand.** The `:root` tokens are the platform theme (`web/src/styles/globals.css`, `gardens/packages/ui` tokens): brand blue `#2A92F4`, slate ink, slate neutrals, and the app's green/amber/red for statuses only. Fonts are Inter and JetBrains Mono. Color the hero ink and the most important section brand blue. Use one more ink tile, light blue tints for light tiles, and white for the rest. Use the logo files in `assets/` and nothing else. `logo-dark.svg` already has the stray outline rectangle that the repo's mobile export carries removed. `mark.svg` is the symbol on its own.
5. **Render and look.** Run `<skill dir>/render.sh <scratch dir>/bento.html <scratch dir>/announcement.png`, then read the PNG. Find and fix three things:
   - a tile with an empty bottom (rebalance the spans, or add its visual);
   - text or shapes that overlap;
   - the width warning the script prints.

   Re-render. You're done when the image has no empty space, no overlaps and no warning.
6. **Deliver.** Show the PNG inline with Markdown image syntax and give its path, plus the HTML path for tweaks. Name any example data in the visuals so the user can check it before posting.
