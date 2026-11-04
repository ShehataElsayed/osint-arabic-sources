/* Tool output routing, local only. Full source case retained with each Office file. */
import {newFile,putFile,esc} from './kernel.js';
export async function caseToOffice(value,{kind='sheet',name='نتيجة من الدليل',navigate=true,id=null}={}){
 if(!value||!Array.isArray(value.records)||!value.records.length)throw Error('لا توجد نتيجة صالحة للتحويل');
 const f=newFile(kind,name);if(id)f.id=id;f.provenanceCase=JSON.parse(JSON.stringify(value));
 const sources=new Map((value.sources||[]).map(s=>[s.id,s]));
 const rows=[['الأداة','العنوان','ملاحظات','المراجعة','المصدر','الرابط','الاقتباس الحرفي']];
 for(const r of value.records){const anchors=r.anchors?.length?r.anchors:[{}];for(const a of anchors){const s=sources.get(a.sourceId)||{};rows.push([r.tool||'',r.title||'',r.note||'',r.review||'unreviewed',s.title||'',s.url||'',a.quote||''])}}
 if(kind==='sheet'){for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++)f.data.sheets[0].cells[`${r+1},${c+1}`]={v:rows[r][c]}}
 else if(kind==='board'){f.data.lists[0].cards=value.records.map((r,i)=>({id:f.id+'-'+i,title:r.title||r.tool,desc:(r.note||'')+'\nالمراجعة: '+(r.review||'unreviewed'),pr:'mid',due:'',labels:[]}))}
 else f.data.html='<h1>'+esc(name)+'</h1>'+rows.slice(1).map(row=>'<h2>'+esc(row[1])+'</h2><p>'+esc(row[2])+'</p><p>المراجعة: '+esc(row[3])+'</p><blockquote>'+esc(row[6])+'</blockquote><p>'+esc(row[4])+' '+esc(row[5])+'</p>').join('');
 await putFile(f);if(navigate)location.href=new URL(({sheet:'sheets',doc:'writer',board:'tasks'})[kind]+'.html?f='+encodeURIComponent(f.id),import.meta.url.replace('/js/tool-bridge.js','/')).href;return f;
}
export function attachOfficeAction(source,build,options={}){
 if(!source)return;const b=document.createElement('button');b.type='button';b.id='office-open';b.textContent='افتح النتيجة في مكتب أوش';b.disabled=source.disabled;source.after(b);
 let generation=0,pending=null,currentId=null;
 async function capture(){const g=++generation;if(source.disabled){pending=null;currentId=null;b.disabled=true;return}
  b.disabled=true;pending=(async()=>{const data=await build();if(g!==generation)return null;const f=await caseToOffice(data,{...options,navigate:false});if(g===generation){currentId=f.id;b.disabled=false;b.textContent='حُفظت نسخة في مكتب أوش - افتح';}return f})();
  try{await pending}catch{if(g===generation){pending=null;b.disabled=source.disabled;b.textContent='افتح النتيجة في مكتب أوش'}}
 }
 new MutationObserver(capture).observe(source,{attributes:true,attributeFilter:['disabled']});
 if(!source.disabled)capture();
 b.onclick=async()=>{b.disabled=true;try{const f=await caseToOffice(await build(),{...options,navigate:true,id:currentId});return f}catch(e){alert('لم تُفتح النتيجة: '+e.message);b.disabled=source.disabled}};
}

/* Automatic successful-AI-result capture. Never sends data or changes the tool's current page. */
export async function captureAIResult(result,{name='نتيجة ذكاء اصطناعي',sourceText='',sourceUrl=location.href,kind='doc'}={}){
 const f=newFile(kind,name);f.aiProvenance={provider:result.provider||'',sourceText,sourceUrl,result:structuredClone(result),review:'unreviewed',generatedAt:Date.now()};
 const rows=result.rows;
 if(kind==='sheet'&&Array.isArray(rows))rows.forEach((row,r)=>row.forEach((v,c)=>{f.data.sheets[0].cells[`${r+1},${c+1}`]={v:v??''}}));
 else {f.kind='doc';f.data={html:'<h1>'+esc(name)+'</h1><p>نتيجة آلية غير مراجعة - '+esc(result.provider||'')+'</p><p>'+esc(result.overview||'')+'</p>'+((result.quotes||[]).map(q=>'<blockquote>'+esc(q)+'</blockquote>').join('')),settings:{font:'Cairo',size:14,dir:'rtl'}}}
 await putFile(f);
 const target=document.getElementById('ai-result')||document.getElementById('ai-list');
 if(target){let a=target.querySelector('[data-office-result-link]');if(!a){a=document.createElement('a');a.dataset.officeResultLink='';a.style.cssText='display:block;padding:10px;margin-top:10px';target.append(a)}a.textContent='حُفظت نسخة في مكتب أوش - افتح للمراجعة';a.href=new URL(({sheet:'sheets',doc:'writer'})[f.kind]+'.html?f='+encodeURIComponent(f.id),import.meta.url.replace('/js/tool-bridge.js','/')).href}
 return f;
}
