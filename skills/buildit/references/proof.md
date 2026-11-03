# Proof on the real surface

For any user-visible change. A green build proves nothing about what users see (the **prove-it-works** principle skill). The work is done when every state a reviewer needs is captured, shown in chat, and attached to the PR.

## Capture

1. Drive the app with `preview_*` for a browser UI or `device_*` for a simulator. Bootstrap empty local state first (setup route, dev menu, seeded data).
2. Walk the happy path and at least one edge case (empty state, validation error, long content). Read the console for new errors.
3. Capture before and after where it applies, the main flow, one narrow viewport (`preview_resize`) if layout changed, and dark mode (`preview_set_appearance`) if styling changed. `preview_snapshot` with `save: true` returns a `screenshotPath`.
4. Interactions (a click that fills or reveals something, async states, multi-step flows, drags, animations) also get a short MP4, recorded with Playwright `recordVideo`. Static layout or copy changes need only screenshots.
5. Playwright is an equally valid path when the T3 browser fights you (popovers that will not open, drags that will not start, lost sessions, `chrome-error://` tabs) or a scripted multi-step or multi-viewport run is more reliable. Reuse the repo's stored role sessions with `test.use({ storageState })`, screenshot each state full-page, and delete the throwaway spec unless it earns a place as a real test. Say which path you used.
6. **Sign-in and recording:** when the repo documents a way to sign in and record the UI, follow it.
7. Fix anything broken or ugly the capture reveals, then capture again. Cut taglines, helper text, and secondary labels; if a screen needs them to make sense, fix the layout.
8. Embed each saved absolute path in chat: `![Ledger page, desktop](/abs/path.png)`. Keep files outside the repo (`/tmp/<ticket>/`).

## Attach to the PR

1. Add a `## Screenshots` section to the body, each image with a short caption and a Markdown reference to its **local** path.
2. Pass the same PNG and MP4 paths to `gh pr create --attach` (later: `gh pr edit <n> --body-file ... --attach ...`). `gh` uploads them and rewrites each image reference to the uploaded URL. Screenshots live only as PR attachments, never on a git branch.
3. `gh` appends a video's URL to the end of the body. Move it onto its own line under a caption in `## Screenshots`, where GitHub renders a player.
4. Uploads need a user token with write access (OAuth or PAT); GitHub App tokens are refused.
5. If review changes the UI, capture again and replace the section.
