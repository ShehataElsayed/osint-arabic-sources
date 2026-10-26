"""Build a static, server-less bundle: python make_web.py <pyodide_dir> <out_dir>.
Runs the Python tools in the browser via Pyodide (WebAssembly). Rule-based tools only; the ONNX model tools and folder/file tools need the local server."""
import json, sys, os, shutil, zipfile, re, glob
src = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); pyo, out = sys.argv[1], sys.argv[2]; MODELS = len(sys.argv) > 3 and sys.argv[3] == "--models"; MODEL_BASE = sys.argv[4] if len(sys.argv) > 4 else "https://huggingface.co"
shutil.rmtree(out, ignore_errors=True); os.makedirs(out + "/py"); os.makedirs(out + "/vendor"); os.makedirs(out + "/ort"); os.makedirs(out + "/static")
for f in ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "pyodide-lock.json", "python_stdlib.zip"] + [os.path.basename(x) for x in glob.glob(pyo + "/numpy-*.whl") + glob.glob(pyo + "/pillow-*.whl")]:
    shutil.copy(os.path.join(pyo, f), out + "/py/" + f)
for w in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "wheels", "*.whl")): shutil.copy(w, out + "/vendor/")
if MODELS:
    ortd = os.path.join(os.path.dirname(pyo.rstrip("/")), "onnxruntime-web", "dist")
    for f in ["ort.wasm.min.js", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]: shutil.copy(os.path.join(ortd, f), out + "/ort/" + f)
for f in os.listdir(src + "/oshai_tools/static"): shutil.copy(src + "/oshai_tools/static/" + f, out + "/static/" + f)
with zipfile.ZipFile(out + "/oshai.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for fn in os.listdir(src + "/oshai_tools"):
        if fn.endswith(".py") and fn not in ("server.py", "__main__.py"): z.write(src + "/oshai_tools/" + fn, "oshai_tools/" + fn)
WHEELS = sorted(os.listdir(out + "/vendor"))
open(out + "/worker.js", "w").write("const WHEELS=" + json.dumps(WHEELS) + ";\nconst MODELS=" + ("true" if MODELS else "false") + ";\n" + """importScripts('py/pyodide.js');if(MODELS)importScripts('ort/ort.wasm.min.js');\n""" + (open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_worker.js"), encoding="utf-8").read().replace("__MB__", json.dumps(MODEL_BASE)) if MODELS else "") + """
let ready=(async()=>{const py=await loadPyodide({indexURL:'py/'});await py.loadPackage(['numpy','pillow']);
 py.unpackArchive(await (await fetch('oshai.zip')).arrayBuffer(),'zip');
 for(const w of WHEELS)py.unpackArchive(await (await fetch('vendor/'+w)).arrayBuffer(),'wheel');
 py.runPython('import sys,json;sys.path.insert(0,"/home/pyodide");import oshai_tools as o');return py})();
ready.then(()=>postMessage({id:0,json:'ready'}));
onmessage=async e=>{const {id,path,body,files}=e.data;try{const py=await ready;
 if(files&&files.length){if(files.length>200||files.some(f=>f.buf.byteLength>20e6)||files.reduce((a,f)=>a+f.buf.byteLength,0)>20e6){postMessage({id,json:JSON.stringify({ok:false,error:'الملفات تتجاوز الحد (200 ملف، 20 ميجابايت إجمالًا)؛ لم يُنفَّذ شيء'})});return}try{py.FS.rmdir('/tmp/up')}catch(_){}
  try{for(const n of py.FS.readdir('/tmp/up').slice(2))py.FS.unlink('/tmp/up/'+n)}catch(_){py.FS.mkdir('/tmp/up')}
  for(const f of files)py.FS.writeFile('/tmp/up/'+f.name.replace(/[^\w.\u0600-\u06FF-]/g,'_'),new Uint8Array(f.buf));}py.globals.set('_p',path);py.globals.set('_b',JSON.stringify(body||{}));
 if(MODELS&&/\/api\/run\/(semcheck|narratives|topics)$/.test(path)){const t=path.split('/').pop();const T=JSON.parse(py.runPython('import json;json.dumps(o.REGISTRY["'+t+'"]["inputs"])'));const kw={};for(const [k] of T){if(body[k]!==undefined&&body[k]!=='')kw[k]=body[k]}
  const res=await runModel(py,t,kw);postMessage({id,json:JSON.stringify(res)});return}
 const r=py.runPython(`
if _p=='/api/tools': _r=[{k:v for k,v in t.items() if k!='run'} for t in o.REGISTRY.values()]
elif _p=='/api/categories':
  from oshai_tools import taxonomy as _tx; _r=_tx.manifest(o.REGISTRY, lambda t: t not in _tx.MODEL_TOOLS)
elif _p=='/api/status': _r={'ai_providers':[],'local_models':{'e5':__M__,'nli':__M__}}
else:
  _t=_p.rsplit('/',1)[1]; _d=json.loads(_b); _T=o.REGISTRY.get(_t)
  if not _T: _r={'ok':False,'error':'unknown tool'}
  else:
    import os
    _k={k:v for k,v in _d.items() if k in [i[0] for i in _T['inputs']] and v!='' and k not in('path','folder')}
    _fs=sorted(os.listdir('/tmp/up')) if os.path.isdir('/tmp/up') else []
    _ks=[i[0] for i in _T['inputs'] if i[2]=='file']
    if _ks and not _fs: _r={'ok':False,'error':'اختر ملفًا أولًا'}
    else:
      if 'folder' in _ks: _k['folder']='/tmp/up'
      elif 'path' in _ks:
        _k['path']='/tmp/up/'+_fs[0]
        if _t=='evidence': _k['ledger']='/tmp/ledger.jsonl'
      _r=o.run(_t,**_k)
json.dumps(_r,ensure_ascii=False)`);postMessage({id,json:r})}catch(err){postMessage({id,json:JSON.stringify({ok:false,error:'تعذر تشغيل بايثون في المتصفح: '+String(err.message).slice(-200)})})}};
""")
_w = open(out + "/worker.js", encoding="utf-8").read().replace("__M__", "True" if MODELS else "False"); open(out + "/worker.js", "w", encoding="utf-8").write(_w)
html = open(src + "/oshai_tools/ui.html", encoding="utf-8").read()
META = """<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' __CSPX__; worker-src 'self'">"""
shim = """<script>(()=>{const MAXF=20e6,MAXT0=100000,CAP={case:20000,similar:30000},LIM=30000;let w,n=0,q={};
let RDY;function start(){RDY=new Promise(r=>{window.__rdy=r});w=new Worker('worker.js');w.onmessage=e=>{if(e.data.progress){const st=document.getElementById('st');if(st)st.textContent=e.data.progress;return}if(e.data.id===0){window.__rdy();return}const c=q[e.data.id];if(c){clearTimeout(c.t);delete q[e.data.id];c.r(e.data.json)}}}start();
const of=window.fetch;window.fetch=async(u,o)=>{if(!String(u).startsWith('/api/'))return of(u,o);
 const body=o&&o.body?JSON.parse(o.body):null;let files=[];
 const bad=(m)=>new Response(JSON.stringify({ok:false,error:m}),{headers:{'Content-Type':'application/json'}});
 if(body){const MAXT=CAP[String(u).split('/').pop()]||MAXT0;for(const k in body)if(typeof body[k]=='string'&&body[k].length>MAXT)return bad('المدخل أطول من الحد لهذه الأداة ('+MAXT+' حرف)');
  const F=window.__F||[];if(String(u).startsWith('/api/run/')){let tot=0;for(const f of F){tot+=f.size;if(tot>MAXF)return bad('حجم الملفات أكبر من 20 ميجابايت');files.push({name:f.name,buf:await f.arrayBuffer()})}}}
 const isRun=String(u).startsWith('/api/run/');const MT=__MODELS__&&/\/(semcheck|narratives|topics)$/.test(String(u));if(MT&&!sessionStorage.getItem('oshai_consent')){if(!confirm('هذه الأداة تحتاج نموذجين من الذكاء الاصطناعي (حوالي 435 ميجابايت). سيحمّلهما متصفحك مرة واحدة من huggingface.co بعد التحقق من SHA-256، ولا يُرسل أي نص من عندك إلى أي جهة. هل توافق؟'))return bad('أُلغي التنزيل؛ لم يُشغَّل شيء');sessionStorage.setItem('oshai_consent','1')}if(isRun){let ok=false;await Promise.race([RDY.then(()=>ok=true),new Promise(r=>setTimeout(r,120000))]);if(!ok)return bad('تعذر تحميل محرك بايثون خلال دقيقتين؛ تحقق من الاتصال وأعد تحميل الصفحة')}
 return new Promise(res=>{const id=++n;const t=setTimeout(()=>{delete q[id];w.terminate();start();res(new Response(JSON.stringify({ok:false,error:'تجاوز التنفيذ '+LIM/1000+' ثانية فتمت إعادة تشغيل المحرك؛ جرّب مدخلًا أصغر'}),{headers:{'Content-Type':'application/json'}}))},isRun?(MT?900000:LIM):300000);
  q[id]={t,r:j=>res(new Response(j,{headers:{'Content-Type':'application/json'}}))};w.postMessage({id,path:u,body,files})})}})();</script>"""
html = html.replace("<html lang=\"ar\" dir=\"rtl\">", "<html lang=\"ar\" dir=\"rtl\">" + META, 1).replace("<script>", shim + "<script>", 1).replace("src=\"/static/", "src=\"static/").replace("url(/static/", "url(static/").replace("'/static/", "'static/")
html = html.replace("__CSPX__", "https://huggingface.co https://*.hf.co" if MODELS else "").replace("__MODELS__", "true" if MODELS else "false")
if MODELS: html = html.replace("نموذج محلي متصل", "نموذج يُنزَّل بموافقتك (تجريبي)").replace("3 تحتاج نموذجًا محليًا غير متاح في هذه النسخة", "3 تنزّل نموذجًا بموافقتك (تجريبي)")
html = html.replace("kind=='file'?`<p class=\"warn\">${e(l)}: متاحة من سطر الأوامر فقط في هذه النسخة.</p>`", "kind=='file'?`<label>${e(l)}<input type=\"file\" ${k=='folder'?'multiple accept=\"image/*\"':''} data-f=\"1\"></label><p class=\"st\">الملفات تُقرأ داخل المتصفح ولا تُرفع إلى أي خادم.</p>`")
html = html.replace("p.querySelectorAll('[name]').forEach(i=>b[i.name]=i.value)", "window.__F=[];p.querySelectorAll('[name]').forEach(i=>b[i.name]=i.value);p.querySelectorAll('input[data-f]').forEach(i=>window.__F.push(...i.files))")
html = html.replace("document.getElementById('n').textContent=t.length;", "document.getElementById('n').textContent=t.length+' (تعمل '+t.filter(x=>!['semcheck','narratives','topics'].includes(x.id)).length+' منها داخل متصفحك الآن؛ 3 تحتاج نموذجًا محليًا غير متاح في هذه النسخة)';",1).replace("نموذج تجريبي يعمل محليًا على جهاز مشغِّله، غير منشور", "نموذج تجريبي يعمل داخل متصفحك ولا يرسل نصوصك إلى أي خادم")
open(out + "/index.html", "w", encoding="utf-8").write(html)
os.makedirs(out + "/THIRD_PARTY")
import subprocess
for n, f in [("Pyodide-MPL-2.0.txt", "/tmp/pyodide-LICENSE.txt"), ("CPython-PSF.txt", "/tmp/cpython-LICENSE.txt"), ("Cairo-OFL.txt", src + "/oshai_tools/static/Cairo-OFL.txt")]:
    if os.path.exists(f): shutil.copy(f, out + "/THIRD_PARTY/" + n)
for w, inner in [("numpy", "numpy-2.0.2.dist-info/LICENSE.txt"), ("pillow", "pillow-10.2.0.dist-info/licenses/LICENSE")]:
    wh = glob.glob(pyo + "/" + w + "-*.whl")[0]
    open(out + "/THIRD_PARTY/" + w + "-LICENSE.txt", "wb").write(zipfile.ZipFile(wh).read(inner))
for wh in glob.glob(out + "/vendor/*.whl"):
    zf = zipfile.ZipFile(wh)
    for n in zf.namelist():
        if "dist-info" in n and os.path.basename(n).upper().startswith(("LICENSE", "LICENCE", "COPYING")) and not n.endswith("/"):
            open(out + "/THIRD_PARTY/" + os.path.basename(wh).split("-")[0] + "-" + os.path.basename(n), "wb").write(zf.read(n))
open(out + "/THIRD_PARTY/NOTICES.md", "w", encoding="utf-8").write("""# Third-party components in this bundle (unmodified, self-hosted)
- Pyodide 0.27.7 (py/pyodide.js, pyodide.asm.js, pyodide.asm.wasm, python_stdlib.zip): MPL-2.0, see Pyodide-MPL-2.0.txt. Source: https://github.com/pyodide/pyodide/tree/0.27.7 . Files are the npm package pyodide@0.27.7 unchanged.
- CPython 3.12 (inside Pyodide): PSF licence, see CPython-PSF.txt.
- numpy 2.0.2 wheel (py/numpy-*.whl), from the Pyodide 0.27.7 distribution, sha256 ebb61241d962b98b21597d7ce43b67668a6d5bab3acec4fbe958657320d7cd08: BSD-3-Clause plus bundled notices, see numpy-LICENSE.txt.
- Pillow 10.2.0 wheel (py/pillow-*.whl), from the Pyodide 0.27.7 distribution, sha256 43eab147a9355385a99eeac18fb577d4af2fe4bd0bbd23d3ba3ddb92e72c2815: HPND (MIT-CMU), see pillow-LICENSE.txt. Used only by imghash and exif.
- Cairo font (static/Cairo.ttf): SIL OFL 1.1, see Cairo-OFL.txt.
- Vendored pure-Python wheels from PyPI, unmodified (py/ not used; see vendor/): dnstwist 20250130 (Apache-2.0, used by the dnstwist tool), oletools 0.60.2 and olefile 0.47 (BSD, used by olevba), pyparsing 3.3.3 (MIT), colorclass 2.2.2 (MIT), easygui 0.98.3 (BSD). Their LICENSE files found in the wheels are in THIRD_PARTY/ as <name>-LICENSE*. Check each file's header before relying on this summary.\n- No machine-learning model weights are included.
Sources of the OshAi Python tools: oshai.zip contains the readable .py files; build script: web_build/make_web.py.
""")
print("ok", sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs) // 1024, "KB")
