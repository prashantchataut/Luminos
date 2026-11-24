#!/usr/bin/env python3
"""Rate-limited, attributed snapshot of public data used for launcher screenshots and as first-paint cache.

Sources (all public, no key): api.mcsrvstat.us (server status + favicon), launchercontent.mojang.com (patch notes).
One request per server, 1.5 s apart, identifying User-Agent. No personal data is stored.
Run: python3 tools/fetch_launcher_cache.py   -> app/src/data/servers-cache.json, app/src/data/news-cache.json
"""
import json, re, time, urllib.request, os
UA = "LuminosResearchBot/0.9 (+https://github.com/prashantchataut/Luminos; polite, cached)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "src", "data")
HOSTS = [("Hypixel", "mc.hypixel.net", ["Minigames", "Skyblock"]), ("CubeCraft", "play.cubecraft.net", ["Minigames", "PvP"]),
         ("Wynncraft", "play.wynncraft.com", ["RPG", "Survival"]), ("Pika Network", "play.pika-network.net", ["Skyblock", "Practice"]),
         ("Mineplex", "mc.mineplex.com", ["Minigames"])]
def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=25) as f: return json.load(f)
def clean(s): return re.sub(r"§.", "", s).strip()
os.makedirs(OUT, exist_ok=True)
servers = []
for name, host, tags in HOSTS:
    try:
        d = get(f"https://api.mcsrvstat.us/3/{host}")
        if not d.get("online"): continue
        servers.append({"name": name, "address": host, "online": d["players"]["online"], "max": d["players"]["max"],
                        "motd": [clean(l) for l in d.get("motd", {}).get("raw", [])][:2], "version": clean(d.get("version", "")) or d.get("protocol", {}).get("name", ""),
                        "icon": d.get("icon", ""), "tags": tags})
    except Exception as e: print("skip", host, e)
    time.sleep(1.5)
json.dump({"source": "api.mcsrvstat.us", "fetchedAt": time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), "servers": servers}, open(f"{OUT}/servers-cache.json", "w"), indent=1)
n = get("https://launchercontent.mojang.com/v2/javaPatchNotes.json")["entries"][:8]
json.dump({"source": "launchercontent.mojang.com/v2/javaPatchNotes.json", "entries": [{"version": e["version"], "title": e["title"], "date": e["date"][:10], "type": e["type"], "text": e.get("shortText", "")} for e in n]}, open(f"{OUT}/news-cache.json", "w"), indent=1)
print(len(servers), "servers,", len(n), "news")
