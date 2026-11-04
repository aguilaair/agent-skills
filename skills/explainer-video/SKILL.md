---
name: explainer-video
description: "Make a narrated explainer film of a product or system, plus a short cut and a click-through presenter deck, from one HTML composition. Use for launch, explainer, walkthrough or demo videos, and for turning one into slides."
---

# Explainer video

One composition, three outputs: the **film** (narrated, rendered to MP4), the **short** (its own script, 60–90 s), and the **deck** (the same animations, one cue per press). Plan for all three from the first line of code. The deck is cheap only if every animation is a declared **beat** the player can find.

## 1 · Licence and sources

Check the licence of any motion library or skill you are pointed at before copying code from it. Several, `onetake` among them, are noncommercial only. Take the method from them and write the engine yourself. Everything below is plain HTML, Playwright, ffmpeg, Kokoro TTS and faster-whisper.

Read the product's README and code until you can name its real pieces, ids, versions and screens. On-screen data is illustrative: invented names, real shapes. Real customer, farm, supplier or person names never go on screen. Put a small "Illustrative data" note in a corner.

## 2 · Concept, then the user picks

Write three concepts that differ in their central picture, not in their wording. One worked well for a pipeline: **one number's journey**. A single fact becomes a **token**, the token travels a map of **stations** (rebuilt UI screens, one per stage), and the camera chases it. Each station transforms the token: its label changes, it gets frozen, it becomes the logo. The token carries every boundary, so nothing reads as a slide change.

For each concept give the hook frame, what carries each boundary, the look (the product's own colours and fonts), and the rough length. Ask the user to pick before writing a script.

## 3 · Script first; the voice sets the clock

1. Write `script/lines.json`: `[{id, ch, text}]`, one line per idea, grouped into chapters. Check every claim against the source.
2. Narrate each line to its own wav (Kokoro ONNX, trimmed). Get word times with faster-whisper (`word_timestamps=True`).
3. Lay the lines out on the film clock: a lead-in, a breath between lines, a longer gap where the camera travels between chapters, a held tail. Write `timeline.js` (`{dur, lines:[{id, ch, text, t0, t1, words}]}`) and an SRT.

Picture is timed to words, never the other way round. Helpers `L(id)`, `E(id)`, `W(id, word, nth)`, `WE(...)` return line and word times in film seconds. Use whisper's spelling of each word. A missing word pushes a warning instead of failing.

## 4 · The engine: every value is f(t)

Build this before any station, and have it working end to end before you split work.

- **Contract:** `window.__ready` (a promise: fonts loaded, stations planned), `window.__seek(t)` (pure, any order, nothing accumulates), `window.__meta = {dur, fps}`, `window.__motion(t0, t1)` (max on-screen travel in px, for motion blur), `window.__warnings`. `?t=12.4` pins a frame; `?play` plays.
- **World:** one large DOM plane under a camera matrix. Stations sit on a grid (`col`, `row`), each a fixed-size root in local coordinates. A dotted path joins them and lights up behind the token.
- **Station:** `station({id, n, label, col, row, build(root), plan(k), update(t, k)})`. `build` writes the markup and returns refs. `plan` runs after fonts load and declares every beat in absolute film seconds. `update` is pure and sets every property it touches for every t.
- **Beat registries:** `appear(el, t0, t1)` (spring in, lift out), `ring(el, t0, t1)` (highlight), `count(el, t0, t1, a, b)`, `during(el, cls, t0, t1)`, `texts(el, [[t, html]])`, `click(t, el)` (cursor), `shot` / `frame` (camera), `tkMove` / `tkLabel` / `tkVis` / `tkScale` (token), `PATH_GLOW`. Every timed change goes through a registry, including station-internal ones (give the station a `beat(t)` helper that registers the time). The deck's cue list is read from these registries, and a beat hidden in `update` arithmetic is a beat the deck cannot stop on.
- **Camera:** shots never overlap in time; the engine warns if they do. Between shots the camera holds with a slow push. A station's first shot is its arrival: it starts just after the previous chapter's last line, about 1.9 s, with a small zoom dip. Text on screen must be at least ~18 px (font px × zoom). Keep framed content clear of the chapter chip at the top and the subtitles at the bottom.
- **Motion:** springs for cards landing, eased camera moves. No CSS transitions or animations, no `Math.random`, no wall clock.
- **`set(el, {x, y, s, op, rot})`** is the one writer of transform and opacity. When it un-hides an element it must restore the full transform, including any centring offset; a bug here pushed the logo off-centre.

Write a stills tool on day one: seek a list of times, write a contact sheet, print page errors and `__warnings`. Read the sheet after every change.

## 5 · Parallel stations

Once two stations render and the engine is proven, split the remaining stations across subagents, one file each. The brief carries: the station API and helpers, the timeline (line ids and times), each station's storyboard (beats on named words, the ids and numbers to show, where the token arrives and leaves), the shared illustrative numbers so stations agree, the stills command, and the rule that agents edit only their own file (CSS injected from that file, names prefixed by station id). Put the brief in a `BRIEF.md` in the project so it stays the source of truth. A separate agent can build render and audio at the same time.

After they land, take stills at every chapter join and check that the token is somewhere sensible in each.

## 6 · Render and sound

- **Render:** N Chromium workers, each seeking a contiguous frame range and screenshotting at 1920×1080. Motion blur: when `__motion` over a 180° shutter exceeds ~6 px, average 2–10 sub-frame captures in linear light. Cache frames under a hash of the comp sources plus the page and render settings, so edits never reuse stale frames and an interrupted render resumes. Encode with ffmpeg (x264, CRF 16, yuv420p, bt709). Tell the user the time estimate before a long render.
- **Sound:** the VO placed at each line's `t0`; a synthesised ambient bed ducked under the VO; soft whooshes on chapter travel; quiet clicks on cursor clicks. Master to −16 LUFS with a true-peak ceiling of about −1.5 dBTP. When envelopes are generated per note, clamp each envelope to the note's length.

## 7 · The short: its own film

Write a new script for it, about 10 lines, one plain sentence per stop. Trimming the long film keeps all its density and adds jumps; that cut was rejected as choppy.

Reuse the world and stations, but show each station in a **finished state**: map each station id to a long-film time (`SNAP`) and evaluate it there. Clear the long film's camera, token and rings, then give each stop one camera glide, one ring on its key element, and one token label. Load the short through its own page and timeline (`?cut=short` or `index_short.html`), and include the page in the render cache hash.

## 8 · The deck: one cue per press

A deck that plays a section and pauses at its end feels like a paused video; that version was rejected. Build a presenter deck instead:

- Collect every beat time from the registries, plus each section start. Merge beats that chain within ~1 s into one **cue**. The LCA film gave 577 beats → 90 cues across 10 sections.
- **Next** plays the current cue to the next cue's start and **freezes** there. Pressed during a cue, it skips to that cue's end. **Back** returns to the previous cue's frozen frame. `[` `]` and number keys jump sections.
- Clock: wall time by default; the narration audio's `currentTime` when voice is on. Voice and captions start off, since the presenter is speaking.
- A bar with section dots and "3 / 13" position, hidden while idle. Speaker notes (`N`): the lines the current cue covers, then the next line. Arrow and PageDown keys, so clickers work. The 1920×1080 stage scales to fit the window.
- Ship it as a folder with `index.html`, assets and the audio as m4a, zipped, opening from `file://` with no server.

Drive it with Playwright before handing it over: the cue list builds, next/back/jump land where they should, no page errors. Then click through every cue yourself and fix freezes that land mid-motion or on an empty frame.

## 9 · Hand-over

Report what you checked (stills, frames from the final MP4, loudness, deck tests) and what you did not (watching it through, browsers you did not test). Outputs go in `out/`: the film and its SRT, the short and its SRT, the deck zip.
