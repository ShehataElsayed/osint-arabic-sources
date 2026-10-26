"""Optional AI layer. Free options only: local Ollama, or an OpenRouter ':free' model if the user supplies a key.
Never invents capability: when no provider is reachable it says so and the deterministic result stands."""
import os, json, urllib.request
GUARD = ("أنت مساعد تدقيق صحفي. استخدم فقط النتائج المقدمة بين الوسمين. لا تضف وقائع. إن لم تكفِ النتائج فقل ذلك. أجب بالعربية في 4 أسطر كحد أقصى.")
def _post(url, body, headers, timeout=60):
    req = urllib.request.Request(url, json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers})
    return json.load(urllib.request.urlopen(req, timeout=timeout))
def providers():
    p = []
    try:
        urllib.request.urlopen(os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434") + "/api/tags", timeout=1.5); p.append("ollama")
    except Exception: pass
    if os.environ.get("OPENROUTER_API_KEY"): p.append("openrouter")
    return p
def explain(tool_id, result, question=""):
    prov = providers()
    if not prov: return dict(ok=False, provider=None, message="لا مزود ذكاء اصطناعي متاح (شغّل Ollama محليًا أو ضع OPENROUTER_API_KEY لنموذج :free). النتيجة أعلاه قواعدية ولا تحتاجه.")
    payload = GUARD + "\n<النتائج>\n" + json.dumps(result, ensure_ascii=False)[:6000] + "\n</النتائج>\n" + (question or "اشرح النتيجة للصحفي وما الذي يجب التحقق منه يدويًا.")
    try:
        if prov[0] == "ollama":
            m = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")
            r = _post(os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434") + "/api/generate", dict(model=m, prompt=payload, stream=False), {}, 120)
            return dict(ok=True, provider="ollama:" + m, text=r.get("response", "").strip())
        m = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
        r = _post("https://openrouter.ai/api/v1/chat/completions", dict(model=m, messages=[{"role": "user", "content": payload}]), {"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"]})
        return dict(ok=True, provider="openrouter:" + m, text=r["choices"][0]["message"]["content"].strip())
    except Exception as e:
        return dict(ok=False, provider=prov[0], message=f"فشل استدعاء النموذج: {type(e).__name__}")
