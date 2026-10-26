"""Local server: python -m oshai_tools.server [port]. Binds 127.0.0.1 only. No data leaves the machine except optional AI calls you configure."""
import json, sys, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from . import REGISTRY, run, ai, embed, nli
PAGE = open(os.path.join(os.path.dirname(__file__), "ui.html"), encoding="utf-8").read()
class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ct="application/json; charset=utf-8"):
        b = body if isinstance(body, bytes) else body.encode(); self.send_response(code)
        self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.send_header("X-Content-Type-Options", "nosniff"); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        self.path = self.path.split("?")[0]
        if self.path == "/": return self._send(200, PAGE, "text/html; charset=utf-8")
        if self.path.startswith("/static/"):
            f = os.path.basename(self.path); fp = os.path.join(os.path.dirname(__file__), "static", f)
            if not os.path.isfile(fp): return self._send(404, "")
            ct = {"svg": "image/svg+xml", "ttf": "font/ttf"}.get(f.rsplit(".", 1)[-1], "application/octet-stream")
            return self._send(200, open(fp, "rb").read(), ct)
        if self.path == "/api/tools":
            return self._send(200, json.dumps([{k: v for k, v in t.items() if k != "run"} for t in REGISTRY.values()] , ensure_ascii=False))
        if self.path == "/api/categories":
            from . import taxonomy; return self._send(200, json.dumps(taxonomy.manifest(REGISTRY, lambda t: True), ensure_ascii=False))
        if self.path == "/api/status": return self._send(200, json.dumps({"ai_providers": ai.providers(), "local_models": {"e5": embed.available(), "nli": nli.available()}}))
        self._send(404, '{"ok":false}')
    def do_POST(self):
        try: body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 2_000_000)) or b"{}")
        except Exception: return self._send(400, '{"ok":false,"error":"bad json"}')
        if self.path.startswith("/api/run/"):
            tid = self.path.rsplit("/", 1)[1]; t = REGISTRY.get(tid)
            if not t: return self._send(404, '{"ok":false,"error":"unknown tool"}')
            kw = {k: v for k, v in body.items() if k in [i[0] for i in t["inputs"]] and v != ""}
            for k, kind in [(i[0], i[2]) for i in t["inputs"]]:
                if kind == "file": return self._send(400, '{"ok":false,"error":"أدوات الملفات تعمل من سطر الأوامر في هذه النسخة"}')
            r = run(tid, **kw)
            if body.get("ai") and t["ai"] and r.get("ok"): r["ai"] = ai.explain(tid, r)
            return self._send(200, json.dumps(r, ensure_ascii=False))
        self._send(404, '{"ok":false}')
    def log_message(self, *a): pass
def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"OshAi tools on http://127.0.0.1:{port}"); ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
if __name__ == "__main__": main()
