// Render the film per language. usage: fv.sh render <project> [--lang en|pt|all] [--workers 6]
// Frames are cached under a hash of the page, engine, data and shots, so an edit never reuses stale
// frames and an interrupted render resumes.
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { launch, openComp, arg, langsOf } from './lib.mjs';

const argv = process.argv.slice(2);
const proj = resolve(argv[0]);
const video = JSON.parse(readFileSync(resolve(proj, 'video.json'), 'utf8'));
const workers = +arg(argv, '--workers', 6);
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

function compHash(lang, fps) {
  const h = createHash('sha1');
  // this language's inputs only, so re-voicing one language leaves the other's frames cached
  for (const f of ['index.html', 'engine/engine.js', 'video.json', `build/timeline-${lang}.json`]) h.update(readFileSync(resolve(proj, f)));
  const shots = resolve(proj, 'shots');
  if (existsSync(shots)) for (const f of readdirSync(shots).sort()) { const s = statSync(join(shots, f)); h.update(`${f}:${s.size}:${s.mtimeMs}`); }
  h.update(`${lang}:${fps}:1920x1080`);
  return h.digest('hex').slice(0, 12);
}

function clickWav() {
  const f = resolve(proj, 'build/click.wav');
  if (!existsSync(f)) ff(['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*2400*t)*exp(-90*t)+0.25*sin(2*PI*900*t)*exp(-60*t)':s=48000:d=0.12", f]);
  return f;
}

const browser = await launch();
for (const lang of langsOf(proj, argv, video)) {
  const probe = await openComp(browser, proj, lang);
  const { meta, warnings, errors } = probe;
  const clicks = await probe.page.evaluate(() => window.__clicks);
  await probe.page.close();
  for (const e of errors) console.log(`[${lang}] PAGE ERROR ${e}`);
  for (const w of warnings) console.log(`[${lang}] WARNING ${w}`);
  if (errors.length) { console.error(`[${lang}] page errors, fix them before rendering`); process.exit(1); }

  const fps = meta.fps;
  const N = Math.ceil(meta.dur * fps);
  const dir = resolve(proj, `build/frames-${lang}-${compHash(lang, fps)}`);
  mkdirSync(dir, { recursive: true });
  const todo = [];
  for (let i = 0; i < N; i++) if (!existsSync(join(dir, `${String(i).padStart(5, '0')}.jpg`))) todo.push(i);
  console.log(`[${lang}] ${N} frames (${meta.dur.toFixed(1)}s @ ${fps}fps), ${N - todo.length} cached, ${todo.length} to render on ${workers} workers`);
  const t0 = Date.now();
  const per = Math.ceil(todo.length / workers);
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const mine = todo.slice(w * per, (w + 1) * per);
    if (!mine.length) return;
    const { page } = await openComp(browser, proj, lang);
    for (const i of mine) {
      await page.evaluate((t) => window.__seek(t), i / fps);
      await page.screenshot({ path: join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (++done % 200 === 0) console.log(`[${lang}]   ${done}/${todo.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await page.close();
  }));

  // audio: narration at each line's t0, a soft click on each cursor click, mastered to -16 LUFS / -1.5 dBTP
  const tl = JSON.parse(readFileSync(resolve(proj, `build/timeline-${lang}.json`), 'utf8'));
  const inputs = [], parts = [];
  tl.lines.forEach((l, i) => {
    inputs.push('-i', resolve(proj, `build/voice-${lang}/${l.id}.wav`));
    parts.push(`[${i}:a]aresample=48000,adelay=${Math.round(l.t0 * 1000)}:all=1[v${i}]`);
  });
  const ck = clickWav();
  clicks.forEach((t, j) => {
    const i = tl.lines.length + j;
    inputs.push('-i', ck);
    parts.push(`[${i}:a]volume=0.35,adelay=${Math.round(t * 1000)}:all=1[v${i}]`);
  });
  const n = tl.lines.length + clicks.length;
  const mix = resolve(proj, `build/mix-${lang}.wav`);
  const filter = parts.join(';') + ';' + Array.from({ length: n }, (_, i) => `[v${i}]`).join('') +
    `amix=inputs=${n}:normalize=0:dropout_transition=0,apad,atrim=0:${meta.dur.toFixed(3)}[out]`;
  const raw = resolve(proj, `build/raw-${lang}.wav`);
  ff([...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '2', '-ar', '48000', raw]);
  // two-pass loudnorm: measure, then apply linearly (one pass undershoots on short speech)
  const LN = 'I=-16:TP=-1.5:LRA=11';
  const probeLog = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${raw}" -af loudnorm=${LN}:print_format=json -f null - 2>&1`]).toString();
  const m = JSON.parse(probeLog.slice(probeLog.lastIndexOf('{'), probeLog.lastIndexOf('}') + 1));
  ff(['-i', raw, '-af', `loudnorm=${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-ar', '48000', mix]);

  mkdirSync(resolve(proj, 'out'), { recursive: true });
  const out = resolve(proj, `out/${video.slug}-${lang}.mp4`);
  ff(['-framerate', String(fps), '-i', join(dir, '%05d.jpg'), '-i', mix,
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', out]);
  let summary = 'loudness not measured';
  try {
    const log = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${out}" -af ebur128=peak=true -f null - 2>&1 | grep -A16 Summary`]).toString();
    const I = /I:\s+(-?[\d.]+) LUFS/.exec(log)?.[1];
    const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(log)?.[1];
    summary = `${I} LUFS, true peak ${TP} dBTP`;
  } catch { /* keep the default */ }
  const mb = (statSync(out).size / 1e6).toFixed(1);
  writeFileSync(resolve(proj, `build/render-${lang}.json`), JSON.stringify({ out, dur: meta.dur, frames: N, mb, loudness: summary, warnings }, null, 1));
  console.log(`[${lang}] ${out}  ${meta.dur.toFixed(1)}s  ${mb} MB  ${summary}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
await browser.close();
