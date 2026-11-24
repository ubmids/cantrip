"""Cut the Cantrip demo video from the raw screen recording.

1920x1080, newsprint background, the app on the left, captions on the right,
narration from macOS `say`. Every frame of the app is a real run (24 Nov 2026)."""
import os
import subprocess
import json
from PIL import Image, ImageDraw, ImageFont

S = "/private/tmp/claude-501/-Users-subomi/46cfe219-8ee8-484f-8295-2d2b13686502/scratchpad"
V = f"{S}/video"
RAW = f"{S}/cantrip-raw.mov"
os.makedirs(V, exist_ok=True)

PAPER = (243, 239, 228)
INK = (26, 24, 21)
RED = (179, 18, 46)
GREEN = (47, 107, 69)
MUTED = (95, 90, 80)
COND = "/System/Library/Fonts/Avenir Next Condensed.ttc"
AVN = "/System/Library/Fonts/Avenir Next.ttc"
def font(path, size, idx):
    return ImageFont.truetype(path, size, index=idx)

HEAVY = lambda s: font(COND, s, 8)      # Avenir Next Condensed Heavy
DEMI = lambda s: font(COND, s, 2)       # Condensed Demi Bold
BODY = lambda s: font(AVN, s, 5)        # Avenir Next Medium

# crop of the app column in the raw 3600x2338 recording (below the extension's pill and inside its glow)
CROP = dict(x=930, y=508, w=1740, h=1352)
APP_H = 1000
APP_W = round(CROP["w"] * APP_H / CROP["h"])
APP_X, APP_Y = 64, 40
PANEL_X = APP_X + APP_W + 56
PANEL_W = 1920 - PANEL_X - 64

SCENES = [
    # raw start, raw end, speed, kicker, headline, sub, narration
    dict(a=1.0, b=9.5, speed=1.0, kicker="REAL RUN · 24 NOV 2026",
         head="Catches job posts that hide there's no pay.",
         sub="Gemini Nano, right here in Chrome.",
         say="Some job posts hide that there's no real pay. Cantrip reads them for you, with Gemini Nano, right here in Chrome."),
    dict(a=11.0, b=49.0, speed=1.8, kicker="HIDDEN-PAY CHECK",
         head="Stamped on your device.",
         sub="3 of 5 flagged. Every check ran on this laptop: about 2 to 7 seconds each, $0, nothing sent.",
         say="One click checks five posts, on this laptop. The ones that hide their pay get stamped, and the giveaway words are underlined. Every check ran on the device. Free, offline, and nothing was sent."),
    dict(a=49.0, b=66.0, speed=1.8, kicker="MAKE YOUR OWN CHECK",
         head="One sentence.",
         sub="Describe the trap. Gemini in the cloud turns it into a program for Gemini Nano.",
         say="Want to catch a different trap? Describe it in one sentence."),
    dict(a=66.0, b=184.0, speed=4.0, kicker="COMPILING · SPED UP 4×",
         head="The cloud writes it. Your device tests it.",
         sub="Each test runs on Gemini Nano. Failures go back to Gemini, which reads why and rewrites the program.",
         say="Gemini in the cloud writes a small program for Gemini Nano, and a set of tests. Cantrip runs each test on the device. When one fails, Gemini reads why, and rewrites the program. Some tests are held back, so the last score is honest."),
    dict(a=184.0, b=222.0, speed=1.6, kicker="COMPILED",
         head="9 of 9. And 3 of 3 on tests it never saw.",
         sub="From now on this check runs on your device, on every page: no cloud call, $0.",
         say="Nine out of nine, and three out of three on tests it never saw. From now on, this check runs on your device, on every page. No cloud call, and no cost."),
]

def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def panel(scene, i, path):
    im = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x, y = PANEL_X, 150
    # step counter + rule
    d.line([(x, y), (x + PANEL_W, y)], fill=INK, width=4)
    d.line([(x, y + 8), (x + PANEL_W, y + 8)], fill=INK, width=2)
    y += 30
    d.text((x, y), scene["kicker"], font=DEMI(30), fill=RED)
    y += 64
    hf = HEAVY(76)
    for line in wrap(d, scene["head"], hf, PANEL_W):
        d.text((x, y), line, font=hf, fill=INK)
        y += 82
    y += 24
    bf = BODY(34)
    for line in wrap(d, scene["sub"], bf, PANEL_W):
        d.text((x, y), line, font=bf, fill=MUTED)
        y += 48
    # footer
    d.text((x, 960), f"{i + 1} / {len(SCENES)}", font=DEMI(28), fill=MUTED)
    d.text((x + 90, 960), "Cantrip · Firebase AI Logic", font=DEMI(28), fill=MUTED)
    im.save(path)

def card(path, big, lines, sub=None):
    im = Image.new("RGB", (1920, 1080), PAPER)
    d = ImageDraw.Draw(im)
    f = HEAVY(220)
    w = d.textlength(big, font=f)
    d.text(((1920 - w) / 2, 300), big, font=f, fill=INK)
    d.line([(360, 590), (1560, 590)], fill=INK, width=6)
    d.line([(360, 602), (1560, 602)], fill=INK, width=2)
    y = 640
    for t, fnt, col in lines:
        w = d.textlength(t, font=fnt)
        d.text(((1920 - w) / 2, y), t, font=fnt, fill=col)
        y += fnt.size + 22
    im.save(path)

def sh(cmd):
    subprocess.run(cmd, check=True, shell=isinstance(cmd, str))

def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])

parts = []
# intro card, 3 s
card(f"{V}/intro.png", "Cantrip", [("Every ad, read for you.", BODY(54), MUTED), ("Cloud compiles  ·  device runs  ·  Firebase AI Logic", DEMI(40), RED)])
sh(f'ffmpeg -loglevel error -y -loop 1 -i {V}/intro.png -f lavfi -i anullsrc=r=48000:cl=stereo -t 3 -vf "fade=in:0:12,format=yuv420p" -r 30 -c:v libx264 -crf 18 -c:a aac -shortest {V}/p0.mp4')
parts.append(f"{V}/p0.mp4")

for i, sc in enumerate(SCENES):
    aiff = f"{V}/n{i}.aiff"
    sh(["say", "-v", "Samantha", "-r", "168", "-o", aiff, sc["say"]])
    nd = dur(aiff)
    vd = (sc["b"] - sc["a"]) / sc["speed"]
    total = max(vd, nd + 0.8)
    panel(sc, i, f"{V}/panel{i}.png")
    c = CROP
    vf = (
        f"[0:v]trim=start={sc['a']}:end={sc['b']},setpts=(PTS-STARTPTS)/{sc['speed']},"
        f"crop={c['w']}:{c['h']}:{c['x']}:{c['y']},scale={APP_W}:{APP_H}:flags=lanczos,fps=30,"
        f"tpad=stop_mode=clone:stop_duration={max(0, total - vd):.2f}[app];"
        f"color=c=0xF3EFE4:s=1920x1080:r=30:d={total:.2f}[bg];"
        f"[bg][app]overlay={APP_X}:{APP_Y}:shortest=1[v1];"
        f"[v1]drawbox=x={APP_X - 2}:y={APP_Y - 2}:w={APP_W + 4}:h={APP_H + 4}:color=0x1A1815@1:t=2[v2];"
        f"[v2][1:v]overlay=0:0,format=yuv420p[v]"
    )
    out = f"{V}/p{i + 1}.mp4"
    sh(["ffmpeg", "-loglevel", "error", "-y", "-i", RAW, "-loop", "1", "-i", f"{V}/panel{i}.png", "-i", aiff,
        "-filter_complex", vf + f";[2:a]aresample=48000,apad=whole_dur={total:.2f},pan=stereo|c0=c0|c1=c0[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{total:.2f}", "-r", "30", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-c:a", "aac", "-b:a", "160k", out])
    parts.append(out)
    print(f"scene {i + 1}: video {vd:.1f}s narration {nd:.1f}s -> {total:.1f}s")

# outro, 4 s
card(f"{V}/outro.png", "Cantrip", [("The cloud writes the program. Your device runs it.", BODY(50), INK), ("sixth-trainer-388221.web.app  ·  github.com/ubmids/cantrip", DEMI(40), RED)])
sh(f'say -v Samantha -r 168 -o {V}/n_out.aiff "The cloud writes the program. Your device runs it. Cantrip, built with Firebase AI Logic."')
od = max(4.5, dur(f"{V}/n_out.aiff") + 1.0)
sh(f'ffmpeg -loglevel error -y -loop 1 -i {V}/outro.png -i {V}/n_out.aiff -filter_complex "[1:a]aresample=48000,apad,pan=stereo|c0=c0|c1=c0[a]" -map 0:v -map "[a]" -t {od:.2f} -vf "fade=out:st={od - 0.6:.2f}:d=0.6,format=yuv420p" -r 30 -c:v libx264 -crf 18 -c:a aac {V}/p9.mp4')
parts.append(f"{V}/p9.mp4")

with open(f"{V}/list.txt", "w") as fh:
    for p in parts:
        fh.write(f"file '{p}'\n")
sh(f"ffmpeg -loglevel error -y -f concat -safe 0 -i {V}/list.txt -c:v libx264 -crf 19 -preset medium -c:a aac -b:a 160k -movflags +faststart {V}/cantrip-demo.mp4")
print("total", round(dur(f"{V}/cantrip-demo.mp4"), 1), "s")
