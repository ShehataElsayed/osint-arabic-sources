"""Pure-Python SentencePiece-Unigram tokenizer driven by a HuggingFace tokenizer.json (XLM-R style: e5 / mDeBERTa). Used where the Rust `tokenizers` package is unavailable (Pyodide).
The Precompiled normalizer is approximated by NFKC + whitespace collapsing; parity is measured in evals/tok_parity.py, not assumed."""
import json, re, unicodedata
class Unigram:
    def __init__(self, path):
        t = json.load(open(path, encoding="utf-8")); m = t["model"]
        self.piece = {p: (i, s) for i, (p, s) in enumerate(m["vocab"])}
        self.unk = m["unk_id"]; self.unk_score = min(s for _, s in m["vocab"]) - 10.0
        self.maxlen = max(len(p) for p in self.piece)
        pp = t["post_processor"]; st = pp["special_tokens"]; single = [x["SpecialToken"]["id"] for x in pp["single"] if "SpecialToken" in x]
        self.cls, self.sep = st[single[0]]["ids"][0], st[single[-1]]["ids"][0]
        self.pad = {a["content"]: a["id"] for a in t["added_tokens"]}.get("<pad>", 1)
        del t, m
    def _norm(self, s):
        s = unicodedata.normalize("NFKC", s); s = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", s)
        return re.sub(r"\s+", " ", s).strip()
    def _viterbi(self, w):
        n = len(w); best = [(-1e18, 0, None)] * (n + 1); best[0] = (0.0, 0, None)
        for e in range(1, n + 1):
            for b in range(max(0, e - self.maxlen), e):
                p = w[b:e]; hit = self.piece.get(p)
                if hit is not None: sc = best[b][0] + hit[1]; idx = hit[0]
                elif e - b == 1: sc = best[b][0] + self.unk_score; idx = self.unk
                else: continue
                if sc > best[e][0]: best[e] = (sc, b, idx)
        out = []; e = n
        while e > 0: _, b, idx = best[e]; out.append(idx); e = b
        out.reverse()
        # merge consecutive unks like sentencepiece/tokenizers
        res = []
        for i in out:
            if i == self.unk and res and res[-1] == self.unk: continue
            res.append(i)
        return res
    def encode_raw(self, text):
        ids = []
        for word in self._norm(text).split(" "):
            if word: ids += self._viterbi("\u2581" + word)
        return ids
    def encode(self, text, max_len=256):
        return [self.cls] + self.encode_raw(text)[: max_len - 2] + [self.sep]
