import {validateCase} from '../journalist-core.js';
import {versionsCase} from './versions-case-core.js';
import{numberChanges}from'./versions-numbers-core.js';
import{claimChanges}from'./versions-claims-core.js';
const $=id=>document.getElementById(id),say=t=>$('status').textContent=t;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const MAXL=800;
function norm(s,ign){s=s.replace(/\r/g,'');return ign?s.replace(/[\t ]+/g,' ').replace(/ +$/gm,''):s}
function lcsOps(a,b){
 const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const ops=[];let i=0,j=0;
 while(i<n&&j<m){if(a[i]===b[j]){ops.push({t:'same',a:i,b:j});i++;j++}else if(dp[i+1][j]>=dp[i][j+1]){ops.push({t:'del',a:i});i++}else{ops.push({t:'add',b:j});j++}}
 while(i<n)ops.push({t:'del',a:i++});
 while(j<m)ops.push({t:'add',b:j++});
 return ops}
function pairBlocks(ops){
 // pair del-runs immediately followed by add-runs into 'mod' pairs
 const out=[];let k=0;
 while(k<ops.length){
  if(ops[k].t==='del'){let d=[];while(k<ops.length&&ops[k].t==='del')d.push(ops[k++]);
   let a=[];while(k<ops.length&&ops[k].t==='add')a.push(ops[k++]);
   const p=Math.min(d.length,a.length);
   for(let x=0;x<p;x++)out.push({t:'mod',a:d[x].a,b:a[x].b});
   for(let x=p;x<d.length;x++)out.push(d[x]);
   for(let x=p;x<a.length;x++)out.push(a[x]);
  }else out.push(ops[k++])}
 return out}
function wordTokens(s){return s.split(/(\s+)/).filter(t=>t!=='')}
function wordDiff(x,y){
 const a=wordTokens(x),b=wordTokens(y);
 if(a.length*b.length>90000)return{pre:[{c:'',s:x}],post:[{c:'',s:y}]};
 const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const pre=[],post=[];let i=0,j=0;
 const push=(arr,c,s)=>{if(!s)return;const l=arr[arr.length-1];if(l&&l.c===c)l.s+=s;else arr.push({c,s})};
 while(i<n&&j<m){if(a[i]===b[j]){push(pre,'',a[i]);push(post,'',a[i]);i++;j++}
  else if(dp[i+1][j]>=dp[i][j+1]){push(pre,'d',a[i]);i++}
  else{push(post,'i',b[j]);j++}}
 while(i<n)push(pre,'d',a[i++]);
 while(j<m)push(post,'i',b[j++]);
 return{pre,post}}
function renderChunks(node,chunks,side){
 for(const ch of chunks){
  if(side==='pre'&&ch.c==='i')continue;
  if(side==='post'&&ch.c==='d')continue;
  if(ch.c==='d'&&side==='pre'){const d=el('del',ch.s);node.append(d)}
  else if(ch.c==='i'&&side==='post'){const ins=el('ins',ch.s);node.append(ins)}
  else node.append(document.createTextNode(ch.s))}}
let last=null,baseCase,caseInvalid=false,generation=0;
function invalidate(){last=null;$('result').hidden=true;$('export').disabled=true;$('case-export').disabled=true;say('تغير المصدر أو الإعداد؛ أعد المقارنة قبل التنزيل.');}
for(const id of ['va','vb','title-a','title-b','url-a','url-b'])$(id).oninput=invalidate;
$('ign-ws').onchange=invalidate;
$('case-file').onchange=async()=>{const g=++generation;caseInvalid=true;baseCase=undefined;try{const f=$('case-file').files[0];if(!f){caseInvalid=false;$('case-status').textContent='قضية جديدة';return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const value=validateCase(JSON.parse(await f.text()));if(g!==generation)return;baseCase=value;caseInvalid=false;$('case-status').textContent='قضية مفتوحة محليًا: '+value.title}catch(e){if(g===generation)$('case-status').textContent='لم تُفتح القضية: '+e.message}};
$('case-export').onclick=()=>{try{if(caseInvalid)throw Error('القضية غير صالحة أو لم يكتمل فتحها');if(!last)throw Error('قارن أولًا');download('journalist-versions-case.json',versionsCase(last,baseCase));$('case-status').textContent='نُزلت نسخة جديدة؛ الأصل وحالات المراجعة السابقة لم تتغير.'}catch(e){$('case-status').textContent='لم تُصدر القضية: '+e.message+'؛ تصدير المقارنة الأصلي ما زال متاحًا.'}};
function download(name,data){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}

$('compare').onclick=()=>{
 const ign=$('ign-ws').checked;
 const rawA=$('va').value,rawB=$('vb').value;
 if(!rawA.trim()||!rawB.trim()){say('الصق النسختين أولًا.');return}
 const A=norm(rawA,ign).split('\n'),B=norm(rawB,ign).split('\n');
 if(A.length>MAXL||B.length>MAXL){say('إحدى النسختين تتجاوز '+MAXL+' سطرًا؛ قسّم الوثيقة وقارنها على أجزاء.');return}
 const ops=pairBlocks(lcsOps(A,B));
 const st={same:0,add:0,del:0,mod:0};
 for(const o of ops)st[o.t]++;
 const total=st.same+st.add+st.del+st.mod;
 const sim=total?Math.round(100*st.same/total):100;
 const sb=$('stats');sb.replaceChildren();
 for(const[v,l]of[[st.same,'سطور مطابقة'],[st.mod,'سطور معدلة'],[st.add,'سطور أضيفت'],[st.del,'سطور حذفت'],[sim+'%','نسبة التطابق السطري']]){
  const d=el('div',undefined,'vd-stat');d.append(el('b',String(v)),el('span',l));sb.append(d)}
 const list=$('diff');list.replaceChildren();
 const frag=document.createDocumentFragment();
 for(const o of ops){
  const row=el('div',undefined,'vd-row vd-'+o.t);
  const la=el('span',o.a!==undefined?String(o.a+1):'','vd-ln'),lb=el('span',o.b!==undefined?String(o.b+1):'','vd-ln');
  const body=el('div',undefined,'vd-text');
  if(o.t==='same')body.textContent=A[o.a];
  else if(o.t==='del'){body.textContent=A[o.a];body.append(el('span','حذف','vd-tag'))}
  else if(o.t==='add'){body.textContent=B[o.b];body.append(el('span','إضافة','vd-tag'))}
  else{const wd=wordDiff(A[o.a],B[o.b]);
   renderChunks(body,wd.pre,'pre');body.append(el('span','تعديل','vd-tag'));body.append(el('br'));renderChunks(body,wd.post,'post')}
  row.append(la,lb,body);frag.append(row)}
 list.append(frag);
 // number-change panel (original spec: surface changed numbers, before/after)
 const nc=numberChanges(ops,A,B),nbox=$('numchg');nbox.replaceChildren();
 if(nc.changes.length||nc.onlyAdded||nc.onlyRemoved){
  nbox.hidden=false;
  nbox.append(el('h3','تغيّر الأرقام بين النسختين'));
  nbox.append(el('p','مطابقة رموز رقمية على مستوى السطور المعدلة؛ كل تغيير قرينة مراجعة يدوية وليس تحققًا من صحة الرقم.','hint'));
  for(const c of nc.changes){
   const card=el('div',undefined,'vn-card');
   card.append(el('p',`سطر ${c.aLine} ← سطر ${c.bLine}`,'vn-lns'));
   card.append(el('p','حُذف: '+(c.removed.join('، ')||'—')+' | أُضيف: '+(c.added.join('، ')||'—'),'vn-nums'));
   const old=el('div',undefined,'vn-old');old.textContent=c.oldText;
   const nw=el('div',undefined,'vn-new');nw.textContent=c.newText;
   card.append(old,nw);nbox.append(card)}
  if(nc.onlyRemoved||nc.onlyAdded)nbox.append(el('p',`أرقام ضمن سطور محذوفة بالكامل: ${nc.onlyRemoved} — أرقام ضمن سطور مضافة بالكامل: ${nc.onlyAdded}`,'vn-extra'));
  if(nc.truncated)nbox.append(el('p','قُصر العرض عند أول ٥٠ تغييرًا رقميًا.','vn-extra'))}
 else nbox.hidden=true;
 // claim-phrasing change panel (leads only - rules cannot judge meaning)
 const cc=claimChanges(ops,A,B),cbox=$('claimchg');cbox.replaceChildren();
 if(cc.length){
  cbox.hidden=false;
  cbox.append(el('h3','تغيّرات محتملة في صيغ الادعاء'));
  cbox.append(el('p','قواعد محلية ترصد تغيّر كلمات النسبة والنفي والتعميم داخل السطور المعدلة؛ لا تحكم على تغيّر المعنى - راجع النصين بنفسك.','hint'));
  for(const c of cc){
   const card=el('div',undefined,'vn-card');
   card.append(el('p',`سطر ${c.aLine} ← سطر ${c.bLine} · كلمات حساسة تغيّرت: ${c.changedSensitive.join('، ')}`,'vn-lns'));
   const old=el('div',undefined,'vn-old');old.textContent=c.oldText;
   const nw=el('div',undefined,'vn-new');nw.textContent=c.newText;
   card.append(old,nw);cbox.append(card)}}
 else cbox.hidden=true;
 $('result').hidden=false;
 last={format:'versions-diff-v1',sources:[{text:rawA,title:$('title-a').value,url:$('url-a').value},{text:rawB,title:$('title-b').value,url:$('url-b').value}],options:{ignoreWhitespace:ign},stats:{...st,similarityPct:sim},limits:'Line-based comparison; moved paragraphs appear as delete+add. Word highlights are approximate token matches.',
  ops:ops.map(o=>({type:o.t,a:o.a!==undefined?A[o.a]:undefined,b:o.b!==undefined?B[o.b]:undefined,aLine:o.a!==undefined?o.a+1:undefined,bLine:o.b!==undefined?o.b+1:undefined}))};
 $('export').disabled=false;$('case-export').disabled=false;
 $('result').scrollIntoView({block:'start'});
 say('اكتملت المقارنة: '+total+' سطرًا ('+st.mod+' معدل، '+st.add+' مضاف، '+st.del+' محذوف).')};
$('export').onclick=()=>{if(!last)return;
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(last,null,2)],{type:'application/json'}));
 a.href=u;a.download='versions-diff.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
