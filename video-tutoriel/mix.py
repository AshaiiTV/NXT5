"""Pose chaque prise de voix à son instant (log.json) et mixe avec la vidéo."""
import json, subprocess, sys
src, out = sys.argv[1], sys.argv[2]
ev = [(k, t) for kind, k, t in json.load(open("log.json")) if kind == "vo"]
args = ["ffmpeg", "-loglevel", "error", "-y", "-i", src]
for k, _ in ev: args += ["-i", f"voice/{k}.mp3"]
f = "".join(f"[{i+1}:a]aresample=48000,adelay={int(t*1000)}:all=1[a{i}];" for i, (k, t) in enumerate(ev))
f += "".join(f"[a{i}]" for i in range(len(ev))) + f"amix=inputs={len(ev)}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[aout]"
args += ["-filter_complex", f, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
subprocess.run(args, check=True); print("ok", out, len(ev), "prises")
