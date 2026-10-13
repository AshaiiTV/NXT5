"""Génère la narration ElevenLabs (une prise par phrase, enchaînées pour une voix fluide).
Usage : ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] python3 voice.py"""
import json, os, subprocess, sys, urllib.request
KEY = os.environ.get("ELEVENLABS_API_KEY") or sys.exit("ELEVENLABS_API_KEY manquante")
VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "AfbuxQ9DVtS4azaxN1W7")  # Léo : voix française native, rassurante et dynamique
MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
N = json.load(open(os.environ.get("NARRATION", "narration.json"))); os.makedirs("voice", exist_ok=True)
keys = list(N); prev_ids = []; durs = {}
for i, k in enumerate(keys):
    body = {"text": N[k], "model_id": MODEL, "language_code": "fr",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True, "speed": 1.0},
            "previous_text": N[keys[i - 1]] if i else None, "next_text": N[keys[i + 1]] if i + 1 < len(keys) else None,
            "previous_request_ids": prev_ids[-3:]}
    if MODEL.startswith("eleven_multilingual_v2"): body.pop("language_code")
    if MODEL.startswith("eleven_v3"):  # v3 : pas d'enchaînement de requêtes, stabilité 0 / 0,5 / 1
        for k2 in ("previous_text", "next_text", "previous_request_ids"): body.pop(k2)
        body["voice_settings"] = {"stability": 0.5}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req) as r:
        open(f"voice/{k}.mp3", "wb").write(r.read()); rid = r.headers.get("request-id")
    if rid: prev_ids.append(rid)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"voice/{k}.mp3"]))
    durs[k] = d; print(k, round(d, 2), N[k])
json.dump(durs, open("voice/durations.json", "w"), indent=1)
