---
name: terradot-logo
description: "Terradot-family logo or app icon: a product, feature, GitHub/Slack app or internal tool marked as a variant of the Terradot mark or the TerraScope ring. Use when asked for a logo, icon, favicon or avatar for anything Terradot."
---

# Terradot logo

A family mark is the parent mark with **one purposeful change made out of its tiles**: cut, regrouped or extended in the mark's own gaps and rounding. A glyph dropped into the centre reads as an icon on top, and the user rejects it every time ("looks lazy", "all look like an icon on top"); a change woven into the tiles "feels purposeful".

## Brand

- Blue `#2C94F4` (the apps' `--primary`), ink `#161616`, white.
- **Terradot mark** (`assets/terradot-mark.d`, 32x32, evenodd): a tiled disc with an open centre, empty circle r≈6.4 at (16, 16). Use it for Terradot-wide tools (Slack apps, VPN, internal services).
- **TerraScope ring** (`terrascope_tiles()` in `marks.py`): two tiled courses split by a crosshair, centre dot r 3.1. Use it for anything TerraScope.
- Existing marks: LCA Platform (sunburst: tiles regrouped into stages and parts, `gardens/lca/src/app/icon.svg` in the monorepo) and Terradot VPN drafts (the open centre becomes a keyhole, its slot cut out through the bottom tiles) are the woven kind to aim for. TerraScope Reviews and Proposals (dot → check, plus) and Terradot Journal (bookmark in the centre) are older glyph swaps, kept only for consistency.

## Steps

1. **Pick the parent and the one change.** Parent by product, as above. Find the shape of the product's idea that the tiles can become: the centre opening into a keyhole, courses regrouped into a chart, a course extended into a shackle. One idea per mark.
2. **Draft three.** Write a drafts file (see the `marks.py` docstring: `APP`, `DRAFTS`, helpers `terradot_shape`, `terrascope_tiles`, `clean`, `rnd`, `stroke`, `pt`, `C`) in a scratch dir and run `logo.sh drafts.py out/`. It writes blue and ink SVGs, 1024px PNGs, and `out/index.html`. Cutting the Terradot mark leaves slivers and notches where its irregular tiles meet the cut: open the full PNG, and run cuts out through an edge or `clean()` the leftovers until every piece reads as a whole tile.
3. **Check at 20px.** Preview `out/index.html` (`html_preview`). A draft passes when its change still reads at 20px, the size GitHub and Slack show beside every message. Fix or drop the ones that turn to a smudge, then show the page (`html_render`) and recommend one, naming the trade-off of the others.
4. **Ship what the user picks.** Hand over the PNG path and copy it to `~/Downloads/<app>.png`. For a web app, add the 32x32 path as `src/app/icon.svg` and a `currentColor` mark component, sized so shared icon rules (`[&_svg]:size-4`) don't shrink it.

## Platform notes

- GitHub app logo: PNG or JPG, full-bleed square (GitHub rounds it). Default `PAD = 56`. Set the badge background to `#2C94F4`.
- Slack app icon: 512–2000px square; set `PAD = 80` so the rounded corners clear the tiles. A manifest sets `background_color` but cannot set the icon, so it is uploaded under Basic Information → Display Information.
