// Experimental: runs ONNX inference (ids -> tensor) in onnxruntime-web. All tokenizing, pooling and tool logic stay in Python (oshai_tools/bridge.py).
const MB=__MB__;
const MF={e5:{model:'Xenova/multilingual-e5-small/resolve/761b726dd34fb83930e26aab4e9ac3899aa1fa78/onnx/model_quantized.onnx',msha:'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193',tok:'Xenova/multilingual-e5-small/resolve/761b726dd34fb83930e26aab4e9ac3899aa1fa78/tokenizer.json',tsha:'0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39',tt:true},
 nli:{model:'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7/resolve/0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0/onnx/model_int8.onnx',msha:'0e00534691cac71d2a9a0319bce19df9d7c6f003acea00bef9967560584c1a77',tok:'Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7/resolve/0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0/tokenizer.json',tsha:'e23095eb61ba944c7be3a5d3e8ec19e37ce7ced0daa03550bde03e83c21b3f8a',tt:false}};
let SESS=null,SESSNAME=null;const TOKOK={};
async function sha(b){const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function dl(path,want,label){const r=await fetch(MB+'/'+path);if(!r.ok)throw new Error('تعذر تنزيل '+label);const len=+r.headers.get('content-length')||0;const rd=r.body.getReader();let buf=len?new Uint8Array(len):null;const parts=[];let got=0;
 for(;;){const {done,value}=await rd.read();if(done)break;if(buf)buf.set(value,got);else parts.push(value);got+=value.length;postMessage({progress:'جارٍ تنزيل '+label+': '+Math.round(got/1e6)+(len?' / '+Math.round(len/1e6):'')+' ميجابايت'})}
 if(!buf){buf=new Uint8Array(got);let o=0;for(const p of parts){buf.set(p,o);o+=p.length}}
 if(await sha(buf)!==want)throw new Error('فشل التحقق من سلامة '+label+' (SHA-256)');return buf}
async function ensureTok(py,name){const m=MF[name];if(!TOKOK[name]){const tk=await dl(m.tok,m.tsha,'مُرمِّز '+name);try{py.FS.mkdir('/tmp/tok')}catch(_){}py.FS.writeFile('/tmp/tok/'+name+'.json',tk);py.runPython('import oshai_tools.bridge as _b\n_b.enable("'+name+'","/tmp/tok/'+name+'.json")');TOKOK[name]=1}}
async function ensure(py,name){if(SESSNAME===name)return;if(SESS){await SESS.release();SESS=null;SESSNAME=null}
 const m=MF[name];
 const mb=await dl(m.model,m.msha,'نموذج '+name);postMessage({progress:'جارٍ تهيئة النموذج…'});
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('ort/',self.location.href).href;SESS=await ort.InferenceSession.create(mb,{executionProviders:['wasm'],graphOptimizationLevel:'basic',enableCpuMemArena:false,enableMemPattern:false});SESSNAME=name}
async function runModel(py,tool,body){await ensureTok(py,'e5');await ensureTok(py,'nli');for(let it=0;it<20;it++){py.globals.set('_tl',tool);py.globals.set('_kw',JSON.stringify(body));
  const r=JSON.parse(py.runPython('import oshai_tools.bridge as _br\n_br.step(_tl,_kw)'));if(r.done)return r.done;
  await ensure(py,r.need);const flat=[];let n=0;
  for(const ids of r.ids){n++;if(n%5==0)postMessage({progress:'استدلال النموذج '+n+' / '+r.ids.length});
   const feed={input_ids:new ort.Tensor('int64',BigInt64Array.from(ids.map(x=>BigInt(x))),[1,ids.length]),attention_mask:new ort.Tensor('int64',BigInt64Array.from(ids.map(()=>1n)),[1,ids.length])};
   if(MF[r.need].tt)feed.token_type_ids=new ort.Tensor('int64',new BigInt64Array(ids.length),[1,ids.length]);
   const out=await SESS.run(feed);flat.push(Object.values(out)[0].data)}
  const all=new Float32Array(flat.reduce((s,x)=>s+x.length,0));let p=0;for(const x of flat){all.set(x,p);p+=x.length}
  py.globals.set('_ids',py.toPy(r.ids));py.globals.set('_fl',all);py.globals.set('_nm',r.need);py.runPython('_br.provide(_nm,_ids,_fl.to_py())')}
 return {ok:false,error:'تعذر إكمال الاستدلال'}}
