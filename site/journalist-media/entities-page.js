import {sentences,validateCase} from '../journalist-core.js';
import {BACKEND_URL} from '../rag-config.js';
import {NOTICE} from '../chat-ui.js';

import {entitiesCase} from './entities-case-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const STOP=new Set(('في من إلى على عن أن إن كان كانت هذا هذه ذلك تلك مع أو ثم قد لا لم لن ما هو هي التي الذي الذين وا ب ك ل منذ حتى بعد قبل عند بين تحت فوق أمام خلال ضد لدى عبر نحو حول كل بعض أي أيضًا حيث عندما إذا لو كما بل لكن يوم اليوم قال قالت أعلن أعلنت أكد أكدت ذكر ذكرت وقال وقالت وأضاف وأضافت إضافة إلى طبقا وفقا بحسب').split(' '));
const MAXD=20;
let baseCase,caseInvalid=false,caseGeneration=0;
let corpus=null,entities=[],edges=[],clusters=[],decisions=[],sel=null,graphSel=null;
function tok(s){return s.split(/\s+/).filter(Boolean)}
function cleanToken(w){return w.replace(/^[،؛:.!؟?«»"“”()\-—]+|[،؛:.!؟?«»"“”()\-—]+$/g,'')}
function splitDocs(t){return t.split(/^===\s*$/m).filter(x=>x.trim())}
function sentencesOf(doc){return sentences(doc).map(s=>({...s,text:s.quote}))}
function positionedWords(sn){return [...sn.text.matchAll(/\S+/g)].map(m=>{const clean=cleanToken(m[0]);const left=m[0].indexOf(clean);return{word:clean,start:sn.start+m.index+left,end:sn.start+m.index+left+clean.length}})}
function extract(docs){
 const grams=new Map();
 docs.forEach((d,di)=>{d.sents.forEach((sn,si)=>{const positions=positionedWords(sn),words=positions.map(w=>w.word);
  for(let n=3;n>=2;n--)for(let i=0;i+n<=words.length;i++){const g=words.slice(i,i+n);
   if(g.some(w=>!w||/^[0-9٠-٩]+$/.test(w)))continue;
   if(STOP.has(g[0])||STOP.has(g[g.length-1]))continue;
   if(g.every(w=>STOP.has(w)||w.length<2))continue;
   const key=g.join(' ');
   if(!grams.has(key))grams.set(key,[]);
   grams.get(key).push({doc:di,sent:si,offset:positions[i].start,mentionEnd:positions[i+n-1].end})}})});
 let list=[...grams.entries()].filter(([,m])=>m.length>=2);
 // suppress shorter grams fully covered by a longer kept gram with the same count
 list.sort((a,b)=>b[0].split(' ').length-a[0].split(' ').length||b[1].length-a[1].length);
 const kept=[];
 for(const[key,m]of list){
  const covered=kept.some(k=>k.key.split(' ').length>key.split(' ').length&&k.key.includes(key)&&k.mentions.length===m.length);
  if(!covered)kept.push({key,mentions:m})}
 return kept.slice(0,120)}
function buildEdges(){
 const map=new Map();
 corpus.docs.forEach((d,di)=>d.sents.forEach((sn,si)=>{
  const present=entities.filter(e=>!e.dismissed&&e.mentions.some(m=>m.doc===di&&m.sent===si)).map(e=>e.key);
  for(let i=0;i<present.length;i++)for(let j=i+1;j<present.length;j++){
   const k=present[i]+'||'+present[j];
   if(!map.has(k))map.set(k,{a:present[i],b:present[j],locs:[]});
   map.get(k).locs.push({doc:di,sent:si})}}));
 edges=[...map.values()].sort((x,y)=>y.locs.length-x.locs.length)}
function renderList(){
 const box=$('list');box.replaceChildren();
 for(const e of entities){
  if(e.dismissed)continue;
  const b=el('button',undefined,'en-item');b.setAttribute('role','listitem');b.setAttribute('aria-pressed',sel===e.key?'true':'false');
  const docs=new Set(e.mentions.map(m=>m.doc)).size;
  b.append(el('span',e.key),el('small',e.mentions.length+' ورود في '+docs+' وثيقة'+(e.ambiguous?' · هوية غير محسومة':'')));
  if(e.ambiguous)b.style.borderStyle='dashed';
  b.onclick=()=>selectEntity(e.key);box.append(b)}
 const dis=entities.filter(e=>e.dismissed);
 if(dis.length){box.append(el('p','مستبعد ('+dis.length+'): '+dis.map(e=>e.key).join('، '),'en-mention'))}}
function selectEntity(key){
 sel=key;const e=entities.find(x=>x.key===key);
 const d=$('detail');d.replaceChildren();
 d.append(el('h3',e.key));
 const chips=el('div');
 chips.append(el('span','مرشح سطحي، ليس تمييزًا آلياً','en-chip'));
 if(e.ambiguous)chips.append(el('span','هوية غير محسومة: قد تعود الصيغة لكيانات مختلفة','en-chip en-warn'));
 else chips.append(el('span','هوية غير محسومة (افتراضي)','en-chip'));
 const cl=clusters.find(c=>c.members.includes(key));
 if(cl)chips.append(el('span','مدمج يدويًا مع: '+cl.members.filter(m=>m!==key).join('، '),'en-chip'));
 d.append(chips,el('h4','مواضع الورود الحرفية'));
 for(const m of e.mentions){
  const sn=corpus.docs[m.doc].sents[m.sent];
  const bq=el('blockquote',sn.text);
  bq.append(el('span',' وثيقة '+(m.doc+1)+' · جملة '+(m.sent+1)+' · إزاحة '+m.offset,'en-mention'));
  d.append(bq)}
 $('toolbar').hidden=false;
 const selx=$('merge-target');selx.replaceChildren();
 for(const o of entities.filter(x=>!x.dismissed&&x.key!==key)){const op=document.createElement('option');op.value=o.key;op.textContent=o.key;selx.append(op)}
 if(!selx.options.length){const o=el('option','لا صيغة أخرى للدمج');o.value='';selx.append(o)}selx.disabled=!selx.value;$('merge').disabled=!selx.value;
 renderList();renderGraph()}
function renderGraph(){
 const g=$('graph');g.replaceChildren();$('edge-detail').hidden=true;
 const ns='http://www.w3.org/2000/svg',W=760,H=340,R=120,CX=W/2,CY=H/2+10;
 const nodes=entities.filter(e=>!e.dismissed&&edges.some(x=>x.a===e.key||x.b===e.key));
 if(!nodes.length){g.append(el('p','لا تزامن جملي بين المرشحات في هذه الوثائق.','en-mention'));return}
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','مخطط التزامن الجملي');
 const pos={};nodes.forEach((e,i)=>{const a=2*Math.PI*i/nodes.length-Math.PI/2;pos[e.key]={x:CX+R*1.9*Math.cos(a),y:CY+R*Math.sin(a)}});
 const maxC=Math.max(...edges.map(e=>e.locs.length));
 for(const ed of edges){if(!pos[ed.a]||!pos[ed.b])continue;
  const show=()=>showEdge(ed);
  const l=document.createElementNS(ns,'line');
  for(const[k,v]of Object.entries({x1:pos[ed.a].x,y1:pos[ed.a].y,x2:pos[ed.b].x,y2:pos[ed.b].y,'stroke-width':1+3*ed.locs.length/maxC,'pointer-events':'none'}))l.setAttribute(k,v);
  l.setAttribute('class','en-edge-vis');
  const mx=(pos[ed.a].x+pos[ed.b].x)/2,my=(pos[ed.a].y+pos[ed.b].y)/2;
  const g=document.createElementNS(ns,'g');g.setAttribute('class','en-edge');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','تزامن '+ed.a+' و '+ed.b);
  const hc=document.createElementNS(ns,'circle');hc.setAttribute('cx',mx);hc.setAttribute('cy',my);hc.setAttribute('r',10);hc.setAttribute('class','en-edge-dot');
  const ht=document.createElementNS(ns,'text');ht.setAttribute('x',mx);ht.setAttribute('y',my+4);ht.setAttribute('text-anchor','middle');ht.setAttribute('class','en-edge-num');ht.textContent=ed.locs.length;
  g.append(hc,ht);
  g.addEventListener('click',show);g.addEventListener('keydown',ev=>{if(ev.key==='Enter')show()});
  svg.append(l,g)}
 for(const e of nodes){
  const gr=document.createElementNS(ns,'g');gr.setAttribute('class','en-node');gr.setAttribute('tabindex','0');gr.setAttribute('role','button');gr.setAttribute('aria-label',e.key);
  const r=10+Math.min(18,e.mentions.length*3);
  const c=document.createElementNS(ns,'circle');c.setAttribute('cx',pos[e.key].x);c.setAttribute('cy',pos[e.key].y);c.setAttribute('r',r);
  const t=document.createElementNS(ns,'text');t.setAttribute('x',pos[e.key].x);t.setAttribute('y',pos[e.key].y+r+16);t.setAttribute('text-anchor','middle');t.textContent=e.key.length>24?e.key.slice(0,24)+'…':e.key;
  gr.append(c,t);
  const go=()=>selectEntity(e.key);gr.addEventListener('click',go);gr.addEventListener('keydown',ev=>{if(ev.key==='Enter')go()});
  svg.append(gr)}
 g.append(svg)}
function showEdge(ed){
 const d=$('edge-detail');d.hidden=false;d.replaceChildren();
 d.append(el('h4','تزامن جملي: '+ed.a+' + '+ed.b),el('p','ورود مشترك في '+ed.locs.length+' جملة. قرينة بحث لا علاقة مثبتة.'));
 for(const l of ed.locs.slice(0,10)){const sn=corpus.docs[l.doc].sents[l.sent];
  d.append(el('blockquote','وثيقة '+(l.doc+1)+': '+sn.text))}}
$('merge').onclick=()=>{const t=$('merge-target').value;if(!sel||!t)return;
 const matching=clusters.filter(c=>c.members.includes(sel)||c.members.includes(t));const members=[...new Set([sel,t,...matching.flatMap(c=>c.members)])];clusters=clusters.filter(c=>!matching.includes(c));clusters.push({members});
 decisions.push({action:'merge',a:sel,b:t,by:'user'});
 say('دُمجت «'+sel+'» مع «'+t+'» كهوية واحدة بقرارك. سُجل في التصدير.');selectEntity(sel)};
$('ambiguity').onclick=()=>{const e=entities.find(x=>x.key===sel);if(!e)return;
 e.ambiguous=!e.ambiguous;
 decisions.push({action:e.ambiguous?'mark-ambiguous':'unmark-ambiguous',key:sel,by:'user'});
 say(e.ambiguous?'عُلمت «'+sel+'»: قد تعود الصيغة لكيانات مختلفة.':'أزيل التعليم عن «'+sel+'».');selectEntity(sel)};
$('dismiss').onclick=()=>{const e=entities.find(x=>x.key===sel);if(!e)return;
 e.dismissed=true;decisions.push({action:'dismiss-not-entity',key:sel,by:'user'});
 sel=null;$('detail').replaceChildren(el('p','استُبعد «'+e.key+'» كغير كيان. سُجل القرار.','en-mention'));$('toolbar').hidden=true;
 buildEdges();renderList();renderGraph();
 say('استُبعد «'+e.key+'». القرار موثق في التصدير.')};
$('extract').onclick=()=>{
 const text=$('src').value;
 if(!text){say('الصق نصًا أولًا.');return}
 const docs=splitDocs(text);
 if(docs.length>MAXD){say('الحد الأقصى '+MAXD+' وثيقة.');return}
 corpus={text,docs:docs.map((d,i)=>({text:d,sents:sentencesOf(d),title:($('source-title').value||'مصدر رصد الكيانات')+' - وثيقة '+(i+1),url:$('source-url').value}))};
 const raw=extract(corpus.docs);
 entities=raw.map(r=>({key:r.key,mentions:r.mentions,ambiguous:false,dismissed:false}));
 clusters=[];decisions=[];sel=null;
 buildEdges();renderList();renderGraph();
 $('result').hidden=false;
 $('export').disabled=!entities.length;$('case-export').disabled=!entities.length;
 say(entities.length+' مرشحًا سطحيًا من '+docs.length+' وثيقة. الهوية غير محسومة افتراضيًا؛ راجع وادمج أو افصل أو استبعد.')};
function data(){return {format:'entities-review-v1',
  limits:'Surface-form recurrence, not NER. Same spelling may be different people; different spellings may be one person. Sentence co-occurrence is a lead, not a relationship. Identity decisions are the reviewer\u2019s.',
  sourceText:corpus.text,documents:corpus.docs.map((d,i)=>({index:i+1,sentences:d.sents.length,text:d.text,title:d.title,url:d.url})),
  entities:entities.map(e=>({surface:e.key,status:e.dismissed?'dismissed':'review',identity:e.ambiguous?'unresolved-ambiguous':'unresolved',mentions:e.mentions.map(m=>({doc:m.doc+1,sentence:m.sent+1,offset:m.offset,mentionEnd:m.mentionEnd,mentionQuote:corpus.docs[m.doc].text.slice(m.offset,m.mentionEnd),start:corpus.docs[m.doc].sents[m.sent].start,end:corpus.docs[m.doc].sents[m.sent].end,quote:corpus.docs[m.doc].sents[m.sent].text}))})),
  clusters,decisions,
  cooccurrence:edges.map(e=>({a:e.a,b:e.b,sentences:e.locs.length,locs:e.locs.map(l=>({doc:l.doc+1,sentence:l.sent+1}))}))};}
$('export').onclick=()=>{if(entities.length)download('entities-review.json',data())};
function download(name,out){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
 a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};

for(const id of ['src','source-title','source-url'])$(id).oninput=()=>{corpus=null;entities=[];edges=[];clusters=[];decisions=[];sel=null;$('result').hidden=true;$('export').disabled=true;$('case-export').disabled=true;say('تغير المصدر؛ أُلغيت المرشحات والقرارات السابقة. أعد الاستخراج.');};
$('case-file').onchange=async()=>{const g=++caseGeneration;caseInvalid=true;baseCase=undefined;try{const f=$('case-file').files[0];if(!f){caseInvalid=false;$('case-status').textContent='قضية جديدة';return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const v=validateCase(JSON.parse(await f.text()));if(g!==caseGeneration)return;baseCase=v;caseInvalid=false;$('case-status').textContent='قضية مفتوحة محليًا: '+v.title}catch(e){if(g===caseGeneration)$('case-status').textContent='لم تُفتح القضية: '+e.message}};
$('case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');if(!corpus)throw Error('استخرج أولًا');download('journalist-entities-case.json',entitiesCase(data(),baseCase));$('case-status').textContent='نُزلت نسخة جديدة؛ الأصل وحالات المراجعة السابقة لم تتغير.'}catch(e){$('case-status').textContent='لم تُصدر القضية: '+e.message+'؛ تصدير الرصد الأصلي ما زال متاحًا.'}};

// AI extraction (user-requested 2026-10-30): the same pasted text goes to the guide's worker,
// which calls Gemini and returns only names that appear verbatim in the source. The local
// surface extractor above stays untouched and remains the fallback. Results are review aids,
// never identity resolution or fact checks; unavailable states are shown, never filled in.
async function aiExtract(){
 const text=$('src').value.trim();
 if(text.length<20){say('الصق نصًا لا يقل عن 20 حرفًا أولًا.');return}
 const btn=$('ai-extract');btn.disabled=true;
 say('يستخرج الذكاء الاصطناعي الكيانات من النص…');
 try{
  const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'extract_entities',text:text.slice(0,12000)})});
  const j=r.ok?await r.json():null;
  const e=j&&j.entities;
  if(!e){say('الاستخراج بالذكاء الاصطناعي غير متاح الآن؛ جرّب لاحقًا أو استخدم الاستخراج المحلي.');return}
  const box=$('ai-list');box.replaceChildren();
  const groups=[['أشخاص',e.persons],['جهات',e.organizations],['أماكن',e.places]];
  let any=false;
  for(const[label,arr]of groups){
   if(!Array.isArray(arr)||!arr.length)continue;any=true;
   const h=el('h3',label+' ('+arr.length+')');box.append(h);
   const wrap=el('div',undefined,'en-toolbar');
   for(const name of arr)wrap.append(el('span',name,'en-chip'));
   box.append(wrap)}
  if(!any){box.append(el('p','لم يجد النموذج كيانات مؤكدة في النص.'))}
  $('ai-notice').textContent=NOTICE;
  $('ai-result').hidden=false;
  say('اكتمل الاستخراج بالذكاء الاصطناعي؛ راجع الأسماء قبل اعتمادها.')}
 catch{say('تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ الاستخراج المحلي ما زال متاحًا.')}
 finally{btn.disabled=false}}
$('ai-extract').onclick=aiExtract;
