// Drive a Mapbox / MapLibre map (react-map-gl) from a capture script. Points, fields and
// popups live on the canvas, not in the DOM, so clicks and targets need map coordinates.
//
//   const { grabMap, frame, at, mark } = require('./map-lib.cjs');
//   await grabMap(page, { layer: 'generic-points-symbols' }); // window.__map, once the style is in
//   await frame(page, [-48.82, -22.72], 14.7);                // jump the camera, wait for idle
//   const p = await at(page, [-48.8228, -22.7238]);           // page px of a lng/lat
//   await page.mouse.click(p.x, p.y);
//   await shoot(page, P, 'after-pick', { field: await mark(page, 'field', lngLat) });
//
// Click a polygon at a point inside it: ST_PointOnSurface, not ST_Centroid, which can fall
// outside a concave field. Keep page.evaluate from returning map objects (wrap in braces).

// Find the map instance through React's fiber tree and keep it on window.__map.
async function grabMap(page, { layer, timeout = 60000 } = {}) {
  await page.waitForFunction(() => {
    const el = document.querySelector(".mapboxgl-map, .maplibregl-map");
    if (!el) return false;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    for (let f = el[key]; f; f = f.return) {
      const r = f.ref && f.ref.current;
      if (r && typeof r.getMap === "function") { window.__map = r.getMap(); return true; }
      if (f.stateNode && typeof f.stateNode.getMap === "function") { window.__map = f.stateNode.getMap(); return true; }
    }
    return false;
  }, null, { timeout });
  await page.waitForFunction((l) => window.__map.isStyleLoaded() && (!l || window.__map.getLayer(l)), layer, { timeout });
  await page.waitForTimeout(1500);
}

// Resize to the container (after a sidebar opens), jump the camera, and wait until it is idle.
async function frame(page, center, zoom) {
  await page.evaluate(([c, z]) => { window.__map.resize(); window.__map.jumpTo({ center: c, zoom: z }); }, [center, zoom]);
  await page.evaluate(() => new Promise((res) => {
    if (window.__map.loaded() && !window.__map.isMoving()) setTimeout(res, 300);
    window.__map.once("idle", () => res());
  }));
  await page.waitForTimeout(800);
}

// Page coordinates of a [lng, lat].
async function at(page, lngLat) {
  return page.evaluate((ll) => {
    const p = window.__map.project(ll);
    const r = window.__map.getCanvas().getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, lngLat);
}

// Make a canvas spot a named shoot() target: an invisible fixed box over [lng, lat].
async function mark(page, name, lngLat, size = 44) {
  const p = await at(page, lngLat);
  await page.evaluate(({ name, p, size }) => {
    let el = document.getElementById(`t-${name}`);
    if (!el) { el = document.createElement("div"); el.id = `t-${name}`; document.body.appendChild(el); }
    Object.assign(el.style, { position: "fixed", left: `${p.x - size / 2}px`, top: `${p.y - size / 2}px`, width: `${size}px`, height: `${size}px`, pointerEvents: "none", zIndex: 99999 });
  }, { name, p, size });
  return `#t-${name}`;
}

module.exports = { grabMap, frame, at, mark };
