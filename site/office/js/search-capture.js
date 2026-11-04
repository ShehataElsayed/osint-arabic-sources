/* Local automatic capture after result validation. Discovery remains unreviewed. */
import {newFile,putFile,esc} from './kernel.js';
async function save(kind,name,result,question,report,target){
 const f=newFile(kind,name);f.aiProvenance={provider:result.provider||'not-reported',sourceText:question,sourceUrl:location.href,result:structuredClone(result),review:'unreviewed',generatedAt:Date.now()};
 if(kind==='doc')f.data.html='<h1>'+esc(name)+'</h1><p>مسودة آلية غير مراجعة، وليست دليل نشر.</p><pre style="white-space:pre-wrap">'+esc(report)+'</pre>';
 else result.rows.forEach((row,r)=>row.forEach((v,c)=>f.data.sheets[0].cells[`${r+1},${c+1}`]={v:v??''}));
 await putFile(f);const a=document.createElement('a');a.dataset.officeCapture='';a.textContent='حُفظت نسخة محلية في مكتب أوش - افتح للمراجعة';a.href=new URL('../'+(kind==='doc'?'writer':'sheets')+'.html?f='+encodeURIComponent(f.id),import.meta.url).href;a.style.cssText='display:block;padding:12px 0';target.append(a);return f;
}
export function captureAsk({result,question,report,target}){
 if(result.leads?.length)report+='\n\nمسارات بحث غير متحققة، ليست إجابة أو دليلاً:\n'+JSON.stringify(result.leads,null,2);
 return save('doc','مساعد NewsRAG - '+question.slice(0,70),result,question,report,target);
}
export function captureSearch({question,items,plan=null,note='',provider='',target}){
 const rows=[['المهمة','الأداة','الرابط','لماذا / الهدف','طريقة الاستخدام','حالة المراجعة','حدود النتيجة']];
 for(const item of items)rows.push([question,item.name,item.url,item.why||'',item.how||'','unreviewed',note]);
 for(const step of plan?.steps||[])rows.push([question,step.tool?.name||'',step.tool?.url||'',step.goal||'',step.how||'','unreviewed','خطوة مقترحة لا عمل منفذ. '+(plan.limits||'')]);
 if(rows.length===1&&!plan)return Promise.resolve(null);
 return save('sheet','بحث الأدوات - '+question.slice(0,70),{rows,plan,provider,note},question,'',target);
}
