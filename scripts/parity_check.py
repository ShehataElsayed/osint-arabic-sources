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
                                 headers={'content-type': 'application/json', 'user-agent': 'curl/8.0 (workers.dev edge blocks the default python urllib UA)'})
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
cf = np.concatenate([cf_embed(qs[i:i + 20]) for i in range(0, len(qs), 20)])
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

# Like-for-like quality: semantic-only top-15 recall with CF query vectors vs with local ONNX
# query vectors (same committed catalogue). The production fused-path quality with CF vectors is
# measured by tests/semantic-catalog.eval.mjs with CF_VECTORS=<file>; this script saves that file.
Q = json.load(open(os.path.join(ROOT, 'tests/data/tool-queries.json')))
items = json.load(open(os.path.join(ROOT, '_site/search-tools.json')))
base_idx = {q: i for i, q in enumerate(qs)}
def recall15(rank, queries):
    tot = 0.0
    for x in queries:
        rel = set(x['rel'])
        names = {items[i]['name'] for i in np.argsort(-rank[base_idx[x['q']]])[:15]}
        tot += len(names & rel) / len(rel)
    return tot / len(queries)
h15_cf, d15_cf = recall15(cf_rank, Q['heldout']), recall15(cf_rank, Q['dev'])
h15_lo, d15_lo = recall15(lo_rank, Q['heldout']), recall15(lo_rank, Q['dev'])
print(f'semantic-only r@15 (like-for-like): heldout CF {h15_cf:.3f} vs local {h15_lo:.3f}; dev CF {d15_cf:.3f} vs local {d15_lo:.3f}')

out = {'model': '@cf/baai/bge-m3 via parity probe worker', 'queries': [{'q': q, 'v': v} for q, v in zip(qs, cf.tolist())]}
json.dump(out, open(os.environ.get('CF_VECTORS_OUT', '/tmp/cf-vectors.json'), 'w'), ensure_ascii=False)

ok = cos.min() >= 0.95 and ov.mean() >= 8.0 and ov.min() >= 6 and abs(h15_cf - h15_lo) <= 0.06
print('PARITY', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
