"""Release gate: parity between the committed local bge-m3 int8 catalogue asset and the live
Workers AI @cf/baai/bge-m3 embeddings (via the temporary probe worker).

Checks, all measured on the 48 eval queries (tests/data/semantic-fixture.json holds the local
int8 encodings of the same texts):
1. encoder similarity: cosine(CF vector, local ONNX vector) per query - mean and min;
2. production ranking agreement: rank the committed int8 catalogue with the CF query vector
   (this is exactly what the production worker does) vs with the local query vector -
   top-10 overlap per query;
3. end-to-end quality with CF query vectors: rerun the new-path metrics and require the
   held-out recall@15 to stay at or above the 12-cap baseline it replaces.

Exits non-zero when parity fails; the asset path must not ship then.
Usage: PROBE_URL=https://<probe>.workers.dev python3 scripts/parity_check.py
"""
import json, os, sys, urllib.request

import numpy as np

PROBE = os.environ.get('PROBE_URL', '').rstrip('/')
if not PROBE:
    sys.exit('PROBE_URL required')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def cf_embed(texts):
    req = urllib.request.Request(PROBE, data=json.dumps({'texts': texts}).encode(),
                                 headers={'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return np.array(json.load(r)['data'], dtype=np.float32)

fx = json.load(open(os.path.join(ROOT, 'tests/data/semantic-fixture.json')))
manifest = json.load(open(os.path.join(ROOT, 'site/tool-embeddings.json')))
raw = open(os.path.join(ROOT, 'site/tool-embeddings.bin'), 'rb').read()
count, dims = manifest['count'], manifest['dims']
scales = np.frombuffer(raw, dtype='<f4', count=count)
cat = np.frombuffer(raw, dtype=np.int8, offset=count * 4).reshape(count, dims).astype(np.float32) * scales[:, None]
cat /= np.linalg.norm(cat, axis=1, keepdims=True)

qs = [x['q'] for x in fx['queries']]
local = np.array([np.array(x['v'], dtype=np.float32) * x['scale'] for x in fx['queries']])
local /= np.linalg.norm(local, axis=1, keepdims=True)
cf = np.stack([cf_embed(qs[i:i + 20]) for i in range(0, len(qs), 20)])
cf /= np.linalg.norm(cf, axis=1, keepdims=True)
assert cf.shape[1] == dims, f'CF dims {cf.shape[1]} != asset dims {dims}'

cos = (cf * local).sum(axis=1)
print(f'encoder parity: cos(CF, local) mean {cos.mean():.4f} min {cos.min():.4f}')

cf_rank = cf @ cat.T
lo_rank = local @ cat.T
ov = []
for i in range(len(qs)):
    a = set(np.argsort(-cf_rank[i])[:10]); b = set(np.argsort(-lo_rank[i])[:10])
    ov.append(len(a & b))
ov = np.array(ov)
print(f'ranking parity: top-10 overlap mean {ov.mean():.1f}/10 min {ov.min()}')

# End-to-end: held-out in-scope queries must still beat the old 12-cap recall@15 baseline (0.678).
Q = json.load(open(os.path.join(ROOT, 'tests/data/tool-queries.json')))
items = json.load(open(os.path.join(ROOT, '_site/search-tools.json')))
qset = [x['q'] for x in fx['queries']]
base_idx = {q: i for i, q in enumerate(qs)}
def recall15(queries):
    tot = 0.0
    for x in queries:
        rel = set(x['rel']); order = np.argsort(-cf_rank[base_idx[x['q']]])[:15]
        names = [items[i]['name'] for i in order]
        tot += sum(1 for n in set(names) if n in rel) / len(rel)
    return tot / len(queries)
h15 = recall15(Q['heldout']); d15 = recall15(Q['dev'])
print(f'quality with CF query vectors (semantic-only top15): heldout r@15 {h15:.3f} dev r@15 {d15:.3f}')

ok = cos.min() >= 0.95 and ov.mean() >= 8.0 and ov.min() >= 6 and h15 >= 0.678
print('PARITY', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
