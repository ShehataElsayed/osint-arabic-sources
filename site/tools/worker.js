const WHEELS=["colorclass-2.2.2-py2.py3-none-any.whl", "dnstwist-20250130-py3-none-any.whl", "easygui-0.98.3-py2.py3-none-any.whl", "olefile-0.47-py2.py3-none-any.whl", "oletools-0.60.2-py2.py3-none-any.whl", "pyparsing-3.3.3-py3-none-any.whl"];
const MODELS=false;
importScripts('py/pyodide.js');if(MODELS)importScripts('ort/ort.wasm.min.js');

let ready=(async()=>{const py=await loadPyodide({indexURL:'py/'});await py.loadPackage(['numpy','pillow']);
 py.unpackArchive(await (await fetch('oshai.zip')).arrayBuffer(),'zip');
 for(const w of WHEELS)py.unpackArchive(await (await fetch('vendor/'+w)).arrayBuffer(),'wheel');
 py.runPython('import sys,json;sys.path.insert(0,"/home/pyodide");import oshai_tools as o');return py})();
ready.then(()=>postMessage({id:0,json:'ready'}));
onmessage=async e=>{const {id,path,body,files}=e.data;try{const py=await ready;
 if(files&&files.length){if(files.length>200||files.some(f=>f.buf.byteLength>20e6)||files.reduce((a,f)=>a+f.buf.byteLength,0)>20e6){postMessage({id,json:JSON.stringify({ok:false,error:'الملفات تتجاوز الحد (200 ملف، 20 ميجابايت إجمالًا)؛ لم يُنفَّذ شيء'})});return}try{py.FS.rmdir('/tmp/up')}catch(_){}
  try{for(const n of py.FS.readdir('/tmp/up').slice(2))py.FS.unlink('/tmp/up/'+n)}catch(_){py.FS.mkdir('/tmp/up')}
  for(const f of files)py.FS.writeFile('/tmp/up/'+f.name.replace(/[^\w.؀-ۿ-]/g,'_'),new Uint8Array(f.buf));}py.globals.set('_p',path);py.globals.set('_b',JSON.stringify(body||{}));
 if(MODELS&&/\/api\/run\/(semcheck|narratives|topics)$/.test(path)){const t=path.split('/').pop();const T=JSON.parse(py.runPython('import json;json.dumps(o.REGISTRY["'+t+'"]["inputs"])'));const kw={};for(const [k] of T){if(body[k]!==undefined&&body[k]!=='')kw[k]=body[k]}
  const res=await runModel(py,t,kw);postMessage({id,json:JSON.stringify(res)});return}
 const r=py.runPython(`
if _p=='/api/tools': _r=[{k:v for k,v in t.items() if k!='run'} for t in o.REGISTRY.values()]
elif _p=='/api/categories':
  from oshai_tools import taxonomy as _tx; _r=_tx.manifest(o.REGISTRY, lambda t: t not in _tx.MODEL_TOOLS)
elif _p=='/api/status': _r={'ai_providers':[],'local_models':{'e5':False,'nli':False}}
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
