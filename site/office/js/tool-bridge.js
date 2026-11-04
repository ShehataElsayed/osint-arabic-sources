/* Tool output routing, local only. Full source case retained with each Office file. */
import {newFile,putFile,esc} from './kernel.js';
export async function caseToOffice(value,{kind='sheet',name='نتيجة من الدليل',navigate=true}={}){
 if(!value||!Array.isArray(value.records)||!value.records.length)throw Error('لا توجد نتيجة صالحة للتحويل');
 const f=newFile(kind,name);f.provenanceCase=JSON.parse(JSON.stringify(value));
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
 new MutationObserver(()=>b.disabled=source.disabled).observe(source,{attributes:true,attributeFilter:['disabled']});
 b.onclick=async()=>{b.disabled=true;try{await caseToOffice(await build(),options)}catch(e){alert('لم تُفتح النتيجة: '+e.message);b.disabled=source.disabled}};
}
