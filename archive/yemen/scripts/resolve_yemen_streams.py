"""Resolve the CURRENT live video id of official news channels from site/data/yemen-streams.json (channel list),
keeping only streams that YouTube reports as live AND embeddable. Output: <out> (default site/data/yemen-streams-live.json).
Uses only public YouTube pages; no API key. A stream that is offline or blocks embedding is simply left out."""
import json, re, sys, urllib.request, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CH = json.load(open(ROOT / 'site' / 'data' / 'yemen-streams.json', encoding='utf-8'))['channels']
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'site' / 'data' / 'yemen-streams-live.json'
def get(u):
    r = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en'})
    return urllib.request.urlopen(r, timeout=25).read().decode('utf-8', 'replace')
live = []
for c in CH:
    try:
        h = get(f"https://www.youtube.com/channel/{c['channel_id']}/live")
        m = re.search(r'"videoId":"([\w-]{11})"', h)
        if not m: continue
        vid = m.group(1)
        w = get(f"https://www.youtube.com/watch?v={vid}")
        if '"isLive":true' not in w or '"playableInEmbed":true' not in w: continue
        if f'"channelId":"{c["channel_id"]}"' not in w: continue
        live.append({'channel_id': c['channel_id'], 'video_id': vid})
    except Exception:
        pass
    time.sleep(1)
OUT.write_text(json.dumps({'checked': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'live': live}, separators=(',', ':')), encoding='utf-8')
print(len(live), 'live of', len(CH))
