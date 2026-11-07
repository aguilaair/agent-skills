"""Terradot logo engine.

usage: logo.sh <drafts.py> <out-dir>

The drafts file runs with this module's names in scope and defines:
  APP     the app's display name, shown in the preview's in-context row
  DRAFTS  a list of dicts {key, title, note, base, shapes}
            base    "terradot", "terrascope" (ring only, no centre dot), or a shapely geometry
            shapes  extra shapely geometries filled in the mark colour
          or {key, title, note, d} with a finished 32x32 path string

All coordinates are in a 32x32 box centred on (16, 16). Writes, per draft,
<key>-blue.svg/.png and <key>-ink.svg/.png (512px, full-bleed), and index.html
comparing every draft at app-icon and avatar sizes.
"""
import html, math, os, runpy, subprocess, sys
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
C = 16
BLUE, INK, WHITE = "#2C94F4", "#161616", "#FFFFFF"
# The Terradot mark's open centre: the largest empty circle is r≈6.4 at (16, 16).
HOLE_R = 6.4


def terradot_d():
    """The Terradot mark as one evenodd path in the 32x32 box."""
    return open(os.path.join(HERE, "assets", "terradot-mark.d")).read().strip()


def pt(r, a):
    """Point at radius r, angle a in degrees clockwise from 12 o'clock."""
    a = math.radians(a - 90)
    return (C + r * math.cos(a), C + r * math.sin(a))


def rnd(g, r):
    """Round every corner of g by r."""
    return g.buffer(-r, 32).buffer(r, 32)


def stroke(points, w):
    """A round-capped polyline of width w."""
    return LineString(points).buffer(w / 2, 16, join_style=1)


def check(w=2.4, scale=1.0):
    return stroke([(C + x * scale, C + y * scale) for x, y in [(-4.2, 0.2), (-1.3, 3.1), (4.4, -3.0)]], w)


def dot(r=3.1):
    """TerraScope's centre dot, for drafts that keep it."""
    return Point(C, C).buffer(r, 64)


def plus(arm=4.6, w=2.6):
    return rnd(unary_union([box(C - w / 2, C - arm, C + w / 2, C + arm), box(C - arm, C - w / 2, C + arm, C + w / 2)]), 0.5)


def terrascope_tiles(extra_cuts=(), dot=True):
    """TerraScope mark E: two tiled courses split by a crosshair, plus the centre dot."""
    rings = [(9.2, 12.3, [45, 135, 225, 315]), (13.0, 15.8, [22, 66, 113, 157, 204, 248, 293, 338])]
    cross, skew, gap = 2.3, 6, 0.75
    shape = unary_union([Point(C, C).buffer(ro, 256).difference(Point(C, C).buffer(ri, 256)) for ri, ro, _ in rings])
    cuts = [box(C - cross / 2, -2, C + cross / 2, 34), box(-2, C - cross / 2, 34, C + cross / 2), *extra_cuts]
    for ri, ro, angs in rings:
        for a in angs:
            cuts.append(LineString([pt(ri - 0.5, a - skew), pt(ro + 0.5, a + skew)]).buffer(gap / 2, cap_style=2))
    t = rnd(shape.difference(unary_union(cuts)), 0.45)
    return unary_union([t, globals()["dot"]()]) if dot else t


def d_of(g):
    out = ""
    for p in getattr(g, "geoms", [g]):
        p = p.simplify(0.02)
        for ring in [p.exterior, *p.interiors]:
            out += "M" + "L".join(f"{x:.2f} {y:.2f}".replace(".00", "") for x, y in list(ring.coords)[:-1]) + "Z"
    return out


def draft_d(dr):
    if "d" in dr:
        return dr["d"]
    base = dr.get("base", "terradot")
    parts = [terradot_d()] if base == "terradot" else [d_of(terrascope_tiles(dot=False) if base == "terrascope" else base)]
    shapes = dr.get("shapes", [])
    if shapes:
        parts.append(d_of(unary_union(shapes)))
    return "".join(parts)


def icon_svg(d, bg, fg, pad):
    s = (512 - 2 * pad) / 32
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="{bg}"/>'
            f'<g transform="translate({pad} {pad}) scale({s:g})"><path fill="{fg}" fill-rule="evenodd" d="{d}"/></g></svg>')


def main(drafts_path, out):
    ns = runpy.run_path(drafts_path, init_globals={k: v for k, v in globals().items() if not k.startswith("__")})
    app, drafts, pad = ns.get("APP", "Terradot app"), ns["DRAFTS"], ns.get("PAD", 56)
    os.makedirs(out, exist_ok=True)
    out = os.path.abspath(out)
    for dr in drafts:
        d = draft_d(dr)
        for name, bg, fg in [("blue", BLUE, WHITE), ("ink", INK, BLUE)]:
            svg = os.path.join(out, f"{dr['key']}-{name}.svg")
            open(svg, "w").write(icon_svg(d, bg, fg, pad))
            subprocess.run(["sips", "-s", "format", "png", "-z", "1024", "1024", svg, "--out", svg[:-4] + ".png"], check=True, capture_output=True)
    open(os.path.join(out, "index.html"), "w").write(page(app, drafts, out))
    print(out)


def page(app, drafts, out):
    def im(k, c, s):
        return f'<img src="{out}/{k}-{c}.svg" style="width:{s}px;height:{s}px;border-radius:{s * 0.2:.0f}px">'
    cards = "".join(
        f'<div class="card"><div class="row">{im(d["key"], "blue", 112)}{im(d["key"], "ink", 112)}</div>'
        f'<div class="row">{im(d["key"], "blue", 40)}{im(d["key"], "blue", 32)}{im(d["key"], "blue", 20)}{im(d["key"], "ink", 20)}</div>'
        f'<div class="ctx">{im(d["key"], "blue", 20)}<b>{html.escape(app)}</b><span>bot</span></div>'
        f'<h3>{html.escape(d["title"])}</h3><p>{html.escape(d.get("note", ""))}</p></div>'
        for d in drafts)
    return f'''<!doctype html><meta charset="utf-8"><style>
body{{font:14px/1.45 var(--font-sans,system-ui);margin:0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}}
.card{{background:#fff;color:#161616;border:1px solid #d0d7de;border-radius:var(--radius,10px);padding:16px}}
.row{{display:flex;gap:12px;align-items:center;margin-bottom:12px}} img{{display:block}}
.ctx{{display:flex;gap:6px;align-items:center;padding:8px 10px;border:1px solid #d0d7de;border-radius:6px;font-size:13px}}
.ctx span{{border:1px solid #d0d7de;border-radius:2em;padding:0 6px;font-size:11px;color:#59636e}}
h3{{margin:14px 0 4px;font-size:15px}} p{{margin:0;color:#444}}
</style><div class="grid">{cards}</div>'''


if __name__ == "__main__":
    main(*sys.argv[1:3])
