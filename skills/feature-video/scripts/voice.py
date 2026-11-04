"""Narrate video.json in every language and lay the lines on the film clock.

usage: voice.py <project dir> [--lang en] [--force]

Writes, per language:
  build/voice-<lang>/<line id>.wav   trimmed narration, 24 kHz mono
  build/timeline-<lang>.json         {dur, lines:[{id, ch, text, t0, t1, marks, words}], warnings}
  out/<slug>-<lang>.srt
and build/data.js (video + shots + timelines) for the engine page.

Narration is cached per line on (text, voice, speed); --force redoes it.
"""

import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import soundfile as sf

CACHE = Path.home() / ".cache" / "feature-video"
KOKORO_LANG = {"en": "en-us", "pt": "pt-br"}
DEFAULT_VOICE = {"en": "af_heart", "pt": "pf_dora"}
WHISPER_LANG = {"en": "en", "pt": "pt"}
SR = 24000

# film clock (seconds)
LEAD = 0.6  # before the first line
GAP = 0.45  # between lines in one chapter
CHAPTER_GAP = 1.1  # camera travels between chapters
CARD_GAP = 0.9  # after a card line, before the screens
TAIL = 2.6  # end card hold after the last line

MARK = re.compile(r"\{([\w-]+)\}")
# whisper writes numbers as digits and hears respellings as the real word, so these never count as misreads
NUMBER_WORDS = set("""zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen
sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million and
um uma dois duas tres quatro cinco seis sete oito nove dez onze doze treze quatorze catorze quinze dezesseis dezessete
dezoito dezenove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa cem cento mil milhao e""".split())


def spoken(text, lexicon):
    """Script text -> what the voice says: drop **, keep {markers}, apply the lexicon."""
    s = text.replace("**", "")
    for word, say in (lexicon or {}).items():
        s = re.sub(rf"(?<![\w-]){re.escape(word)}(?![\w-])", say, s)
    return s


def tokens_with_marks(s):
    """Split spoken text into words; return (words, {marker: word index})."""
    words, marks = [], {}
    for tok in s.split():
        while True:
            m = MARK.match(tok)
            if not m:
                break
            marks[m.group(1)] = len(words)
            tok = tok[m.end():]
        tok = MARK.sub("", tok)
        if tok:
            words.append(tok)
    return words, marks


def norm(w):
    w = unicodedata.normalize("NFKD", w.lower())
    w = "".join(c for c in w if not unicodedata.combining(c))
    return re.sub(r"[^\w]", "", w)


def trim(audio, thresh=0.006, pad=0.06):
    idx = np.where(np.abs(audio) > thresh)[0]
    if not len(idx):
        return audio
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(audio), idx[-1] + int(pad * SR))
    return audio[a:b]


def load16k(path):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, np.float32)


def align(script_words, whisper_words, dur, warnings, line_id, expected=frozenset()):
    """Give every script word a start time, from whisper's words where they match."""
    S = [norm(w) for w in script_words]
    Wn = [norm(w["word"]) for w in whisper_words]
    times = [None] * len(S)
    sm = SequenceMatcher(None, S, Wn, autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            times[a + k] = whisper_words[b + k]["start"]
    # unmatched words: interpolate between neighbours by character count
    missed = [script_words[i] for i, t in enumerate(times)
              if t is None and S[i] and not S[i].replace("_", "").isdigit()
              and not {norm(x) for x in script_words[i].split("-")} <= NUMBER_WORDS and S[i] not in expected]
    if missed:
        warnings.append(f"line {line_id}: the voice read-back did not match {missed}; listen to that line")
    known = [(i, t) for i, t in enumerate(times) if t is not None]
    if len(known) < max(1, len(S) // 2):
        warnings.append(f"line {line_id}: whisper matched only {len(known)}/{len(S)} words; marker times are estimates")
    anchors = [(-1, 0.0)] + known + [(len(S), dur)]
    for (i0, t0), (i1, t1) in zip(anchors, anchors[1:]):
        if i1 - i0 <= 1:
            continue
        span = S[i0 + 1:i1]
        total = sum(len(w) + 1 for w in span) or 1
        acc = 0
        for j, w in enumerate(span):
            times[i0 + 1 + j] = t0 + (t1 - t0) * acc / total
            acc += len(w) + 1
    return times


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    proj = Path(args[0]).resolve()
    force = "--force" in args
    only = args[args.index("--lang") + 1] if "--lang" in args else None
    video = json.loads((proj / "video.json").read_text())
    langs = [only] if only else video["langs"]
    (proj / "build").mkdir(exist_ok=True)
    (proj / "out").mkdir(exist_ok=True)

    kokoro = whisper = None
    for lang in langs:
        voice = video.get("voices", {}).get(lang, DEFAULT_VOICE[lang])
        speed = video.get("speed", {}).get(lang, 1.0)
        lexicon = video.get("lexicon", {}).get(lang, {})
        vdir = proj / "build" / f"voice-{lang}"
        vdir.mkdir(parents=True, exist_ok=True)
        cache_file = vdir / "cache.json"
        cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
        warnings, out_lines = [], []
        t = LEAD
        prev = None
        for line in video["lines"]:
            text = line[lang]
            say = spoken(line.get("say", {}).get(lang, text), lexicon)
            words, marks = tokens_with_marks(say)
            key = hashlib.sha1(json.dumps([" ".join(words), voice, speed]).encode()).hexdigest()[:16]
            wav = vdir / f"{line['id']}.wav"
            entry = cache.get(line["id"])
            if force or not wav.exists() or not entry or entry["key"] != key:
                if kokoro is None:
                    from kokoro_onnx import Kokoro
                    kokoro = Kokoro(str(CACHE / "kokoro-v1.0.onnx"), str(CACHE / "voices-v1.0.bin"))
                audio, sr = kokoro.create(" ".join(words), voice=voice, speed=speed, lang=KOKORO_LANG[lang])
                assert sr == SR
                audio = trim(np.asarray(audio, np.float32))
                sf.write(wav, audio, SR)
                if whisper is None:
                    from faster_whisper import WhisperModel
                    whisper = WhisperModel("small", device="cpu", compute_type="int8", download_root=str(CACHE / "whisper"))
                segs, _ = whisper.transcribe(load16k(wav), language=WHISPER_LANG[lang], word_timestamps=True)
                ww = [{"word": w.word.strip(), "start": float(w.start), "end": float(w.end)} for s in segs for w in s.words]
                entry = {"key": key, "dur": len(audio) / SR, "whisper": ww}
                cache[line["id"]] = entry
                print(f"[{lang}] {line['id']}: {entry['dur']:.2f}s  {' '.join(w['word'] for w in ww)}")
            dur = entry["dur"]
            respelled = {norm(w) for say_as in lexicon.values() for w in say_as.split()}
            starts = align(words, entry["whisper"], dur, warnings, line["id"], respelled)
            # gap before this line
            if prev is not None:
                if prev.get("card") and not line.get("card"):
                    t += CARD_GAP
                elif prev.get("ch") != line.get("ch"):
                    t += CHAPTER_GAP
                else:
                    t += GAP
                t += line.get("pause", 0)
            t0, t1 = round(t, 3), round(t + dur, 3)
            mk = {}
            for name, idx in marks.items():
                mk[name] = round(t0 + (starts[idx] if idx < len(starts) else dur), 3)
            for name in MARK.findall(text):
                if name not in mk:
                    warnings.append(f"line {line['id']} ({lang}): marker {{{name}}} is in the subtitle text but not in the spoken text")
            out_lines.append({
                "id": line["id"], "ch": line.get("ch"), "text": text, "t0": t0, "t1": t1, "marks": mk,
                "words": [{"w": w, "t": round(t0 + s, 3)} for w, s in zip(words, starts)],
            })
            t = t1
            prev = line
        dur = round(t + TAIL, 2)
        # every language must carry the same markers on each line
        for line in video["lines"]:
            names = {lg: set(MARK.findall(line.get("say", {}).get(lg, line[lg]))) for lg in video["langs"]}
            if len({frozenset(v) for v in names.values()}) > 1:
                warnings.append(f"line {line['id']}: markers differ between languages {names}")
        tl = {"dur": dur, "lang": lang, "lines": out_lines, "warnings": warnings}
        (proj / "build" / f"timeline-{lang}.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
        cache_file.write_text(json.dumps(cache, ensure_ascii=False))
        write_srt(proj / "out" / f"{video['slug']}-{lang}.srt", out_lines)
        print(f"[{lang}] {len(out_lines)} lines, {dur:.1f}s")
        for w in warnings:
            print(f"[{lang}] WARNING {w}")

    write_data(proj, video)


def srt_time(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(path, lines):
    out = []
    for i, l in enumerate(lines, 1):
        text = re.sub(r"\s+", " ", MARK.sub("", l["text"]).replace("**", "")).strip()
        out.append(f"{i}\n{srt_time(l['t0'])} --> {srt_time(l['t1'] + 0.3)}\n{text}\n")
    path.write_text("\n".join(out))


def write_data(proj, video):
    shots_file = proj / "shots" / "shots.json"
    shots = json.loads(shots_file.read_text()) if shots_file.exists() else {}
    tls = {}
    for lang in video["langs"]:
        f = proj / "build" / f"timeline-{lang}.json"
        if f.exists():
            tls[lang] = json.loads(f.read_text())
    data = {"video": video, "shots": shots, "timelines": tls}
    (proj / "build" / "data.js").write_text("window.FV = " + json.dumps(data, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    if "--data-only" in sys.argv:
        p = Path(sys.argv[1]).resolve()
        write_data(p, json.loads((p / "video.json").read_text()))
    else:
        main()
