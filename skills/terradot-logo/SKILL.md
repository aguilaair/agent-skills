---
name: terradot-logo
description: "Terradot-family logo or app icon: a product, feature, GitHub/Slack app or internal tool marked as a variant of the Terradot mark or the TerraScope ring. Use when asked for a logo, icon, favicon or avatar for anything Terradot."
---

# Terradot logo

A family mark is the parent mark with **one purposeful change**, never a symbol laid on top of it. The bar the user set: overlays "look lazy"; a change woven into the tiles or the centre "feels purposeful".

## Brand

- Blue `#2C94F4` (the apps' `--primary`), ink `#161616`, white.
- **Terradot mark** (`assets/terradot-mark.d`, 32x32, evenodd): a tiled disc with an open centre, empty circle r≈6.4 at (16, 16). Use it for Terradot-wide tools (Slack apps, VPN, internal services).
- **TerraScope ring** (`terrascope_tiles()` in `marks.py`): two tiled courses split by a crosshair, centre dot r 3.1. Use it for anything TerraScope.
- Shipped variants to stay consistent with: TerraScope Reviews (ring, dot → check), TerraScope Proposals (ring, dot → plus), Terradot Journal (Terradot mark, bookmark in the centre), LCA Platform (sunburst: tiles regrouped into stages and parts, `gardens/lca/src/app/icon.svg` in the monorepo).

## Steps

1. **Pick the parent and the one change.** Parent by product, as above. The change is a glyph in the centre (the Terradot hole, or the TerraScope dot's place), or the tiles themselves rearranged to tell the story (sunburst). One idea per mark.
2. **Draft three.** Write a drafts file (see the `marks.py` docstring: `APP`, `DRAFTS`, shapely helpers `rnd`, `stroke`, `check`, `plus`, `dot`, `pt`, `C`) in a scratch dir and run `logo.sh drafts.py out/`. It writes blue and ink SVGs, 1024px PNGs, and `out/index.html`.
3. **Check at 20px.** Preview `out/index.html` (`html_preview`). A draft passes when its glyph still reads at 20px, the size GitHub and Slack show beside every message. Fix or drop the ones that turn to a smudge, then show the page (`html_render`) and recommend one, naming the trade-off of the others.
4. **Ship what the user picks.** Hand over the PNG path and copy it to `~/Downloads/<app>.png`. For a web app, add the 32x32 path as `src/app/icon.svg` and a `currentColor` mark component, sized so shared icon rules (`[&_svg]:size-4`) don't shrink it.

## Platform notes

- GitHub app logo: PNG or JPG, full-bleed square (GitHub rounds it). Default `PAD = 56`. Set the badge background to `#2C94F4`.
- Slack app icon: 512–2000px square; set `PAD = 80` so the rounded corners clear the tiles. A manifest sets `background_color` but cannot set the icon, so it is uploaded under Basic Information → Display Information.
