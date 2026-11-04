---
name: feature-video
description: "Narrated before/after video of a feature change for the ops team, in English and Brazilian Portuguese, filmed on the branch's real screens. Use when a feature that changes an ops workflow is built and waiting to merge, or when asked for a feature, training or change video."
---

# Feature video

Ops and software agreed that a feature which changes an ops workflow is not merged until ops have seen it: build it, record a short video against the branch, share it, wait for ops to sign off, then merge. Ops use the video to train field teams before the change lands, not after. This skill makes that video: about a minute long, one film per language (EN and PT-BR), real screens of the branch, before → now → watch out.

It is a light variant of `explainer-video`: one fixed shape, no concept round, no short cut, no deck. The engine, voice and render tooling ship with the skill. Every command is in `fv.sh` (its header lists them). `example/` holds a finished pilot: the spreading-map passes feature (#4069), with its `video.json` and `capture.cjs`. Read both before you write your own.

## 1 · The change card

Read the PR body, the diff and the Linear issue. Write down, in plain words:

- **who** does this work (a role, such as "whoever downloads spreading maps"), and on which screen;
- **before**: the steps they take today;
- **now**: the steps after the change, one action each;
- **unchanged**: what they might expect to change but won't;
- **watch out**: the mistake people will make. Look for a value that is recorded but has no effect, a new warning, or a default they must change;
- **when** it ships, if known.

Done when every step names a button, field or column that exists in the branch's code, with its exact on-screen label.

## 2 · Capture the screens

Run the branch's app and drive it with Playwright. The monorepo explains how: `web/docs/local-ui-verification.md` covers the stack, the Clerk sign-in token, and `NODE_PATH` from wms-app. Use a worktree of your own. The worktree database is a copy of real data, so set any state you need there, such as a saved value or an unreviewed event. Never set it anywhere else.

- `fv.sh init <project dir>` copies in the engine page and `capture-lib.cjs`. Keep the project and its capture script outside the repo.
- Use `shoot(page, project, id, targets, {redact, hide})` once per UI state: the table, the dialog open, the dialog after typing, and so on. Targets are named locators. Every ring, click, label and focus in the script points at a target name. Shots of one page share coordinates, so the camera cross-fades between them without jumping.
- **Before** shots: in the same worktree, check out main's version of the changed component files (`git show main:<path> > <path>`). Shoot once hot reload picks them up, then `git checkout` them back. If the "before" screen does not exist yet, show where the work happens today instead.
- Viewport 1280×800 at deviceScaleFactor 2. Shoot the whole viewport, not a crop, so the camera has context.
- Blur names of farms and people, contacts and prices (`redact`). Hide dev chrome such as `nextjs-portal` (`hide`).

Done when `shots/shots.json` holds every target the script will name, and you have read every PNG with nothing private left on it.

## 3 · Script: `video.json`

The shape is fixed: a title-card hook, then **Before** (1–2 lines), **Now** (one action per line), **Watch out** (1–2 lines), and an end card ("Questions? Ask in #…"). That is 10–14 lines, 55–80 s. Copy the shape from `example/video.json`, which also shows every field.

- One sentence per line, at most ~110 characters in **each** language, so the subtitle stays on two lines. The engine warns past 110.
- Name the UI exactly as it appears on screen, in `**bold**`. The app is in English, so the Portuguese subtitles keep the English labels (`**Max rate per pass**`). The Portuguese voice says what the label means, set through `say.pt`, or a respelling set in `lexicon.pt` (`"Download": "Dáunloud"`).
- Write Portuguese the way the ops team in Brazil talks: talhão, passada, distribuidora, pó de rocha, taxa (kg/ha), umidade, fazenda. Write Brazilian forms ("você", "baixar", "clique").
- Spell numbers as digits in the text and as words in `say` ("15 mil" → "quinze mil"). Write `kg/ha` and the like once in the lexicon.
- Say negations in full: "can only", "cannot", "does **not**". Kokoro swallows the t of "can't", and the sentence flips.
- A marker `{name}` goes right before the word a beat lands on. Each line carries the same markers in both languages, and in `say` when `say` is used.
- Beats, per line: `shot` (a cross-fade to another capture), `focus` + `pad` (a camera move to a target), `ring` (+ `warn` for amber, `until` a marker or line id), `click` (the cursor travels there and clicks), and `label` (`side`, `style`, `en`/`pt`, `\n` for stacked lines). `at` takes a marker, `marker+0.3`, `end`, or a line id. A line-level `shot`/`focus` moves the camera as the line starts.

Done when every claim matches the change card and the code, and both languages carry the same lines and markers.

## 4 · Voice and timing

Run `fv.sh voice <project>`. It narrates each line with Kokoro (en: `af_heart`, pt: `pf_dora`), reads it back with whisper to time every word, lays the lines on the film clock, and writes the SRTs and `build/data.js`. It prints what whisper heard for every line it re-narrates. Read those lines as a listener would. A dropped negation, a wrong number or a mangled UI word is a misread: reword the line or fix its lexicon entry, and run it again. Unchanged lines stay cached.

Done when every read-back line means what the script says, and the only `WARNING` lines left are words you have checked, such as "shapefile" heard as "shape file".

## 5 · Stills

Run `fv.sh stills <project> --lang en`, then again with `--lang pt`. Read both contact sheets, and seek single times (`fv.sh stills <project> --lang pt 43.6`) to see a frame at full size. Look for:

- a ring or click on the wrong element, or landing before the word it belongs to;
- a label covering the thing it explains, or sitting behind the subtitle;
- text you could not read on a phone; focus tighter if so (the engine warns when 14 px app text drops below ~18 px);
- the PT film, not just the EN one. Its lines run longer and break differently.

Fix, re-run, look again. Done when both sheets are clean and the page prints no errors or warnings, apart from the read-back words you accepted.

## 6 · Render

Run `fv.sh render <project>`. It takes about a minute per language. It renders frames on six Chrome workers, mixes the voice with soft clicks, masters to −16 LUFS / −1.5 dBTP, and encodes H.264 yuv420p (about 14 MB, which WhatsApp takes). The frame cache is per language and resumes. Pull a few frames from each MP4 and look at them at chat size.

## 7 · Hand-over

Outputs are in `out/`: `<slug>-en.mp4`, `<slug>-pt.mp4`, and their SRTs. Subtitles are burned in, because field teams watch on phones with the sound off.

- Draft the post for ops in EN and PT: what changes, who it affects, both videos, and that the merge waits for their OK. Ask before posting it anywhere, and before attaching the videos to the PR.
- Report what you checked (read-backs, both stills sheets, frames from both MP4s, loudness) and what you did not. You cannot listen: ask the user to listen to the PT film once for how the English terms sound.
- Stop the dev servers. Remove the worktree if you made it for this (`just worktree-remove <branch>`).

## Changing the engine

The engine is `engine/engine.js` + `engine/index.html` in this skill. `fv.sh init` copies them into a project, and re-running it refreshes the copy and keeps `video.json`. Improve the skill's copy, not the project's. Every value on screen is a pure function of film time through `window.__seek(t)`. `?lang=pt&t=12.4` pins a frame, and `?lang=pt&play` plays it with the voice in a browser.
