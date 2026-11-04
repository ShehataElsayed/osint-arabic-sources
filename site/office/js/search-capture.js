/* Local automatic capture after result validation. Discovery remains unreviewed. */
import {newFile,putFile,esc} from './kernel.js';
async function save(kind,name,result,question,report,target){
 const f=newFile(kind,name);f.aiProvenance={provider:result.provider||'not-reported',sourceText:question,sourceUrl:location.href,result:structuredClone(result),review:'unreviewed',generatedAt:Date.now()};
 if(kind==='doc')f.data.html='<h1>'+esc(name)+'</h1><p>مسودة آلية غير مراجعة، وليست دليل نشر.</p><pre style="white-space:pre-wrap">'+esc(report)+'</pre>';
 else result.rows.forEach((row,r)=>row.forEach((v,c)=>f.data.sheets[0].cells[`${r+1},${c+1}`]={v:v??''}));
 await putFile(f);const a=document.createElement('a');a.dataset.officeCapture='';a.textContent='حُفظت نسخة محلية: '+name+' - افتح في مكتب أوش للمراجعة';a.href=new URL('../'+(kind==='doc'?'writer':'sheets')+'.html?f='+encodeURIComponent(f.id),import.meta.url).href;a.style.cssText='display:block;padding:12px 0';target.append(a);return f;
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

export function captureDiscovery({question,facts,news,target}){
 const rows=[['النوع','النص / الادعاء','الناشر / المدقق','التقييم المنقول','الرابط','التاريخ','حالة المراجعة','الحدود']];
 for(const it of news?.items||[])rows.push(['RSS',it.title,it.source,'',it.url,it.published||'','unreviewed','عنوان للاكتشاف فقط، ليس المقال كاملاً أو تحققاً.']);
 if(facts?.summary)rows.push(['ملخص آلي للمراجعات',facts.summary,facts.provider||'not-reported','','','','unreviewed','ملخص للمراجعات المطابقة فقط، وليس تحققاً مستقلاً.']);
 if(facts?.coverage)rows.push(['تغطية لغة المراجعات',facts.coverage,'','','','','unreviewed','المطابقة بالكلمات، وليست تأكيداً حرفياً للخبر.']);
 for(const m of facts?.matches||[])rows.push(['مراجعة تحقق',m.claim,m.publisher,m.rating,m.url,m.date||'','unreviewed','تقييم جهة التحقق المذكورة، لا حكم الدليل. طابق الخبر بالمراجعة الأصلية.']);
 if(facts?.error)rows.push(['حالة خدمة التحقق','','',facts.error,'','','unreviewed','تعذر الفحص، النتيجة غير معروفة.']);
 else if(facts&&!(facts.matches||[]).length)rows.push(['حالة خدمة التحقق','','','لا مراجعات مطابقة','','','unreviewed','غياب مراجعة ليس دليلاً على صحة الخبر أو كذبه.']);
 if(rows.length===1)return Promise.resolve(null);
 return save('sheet','اكتشافات ومراجعات - '+question.slice(0,70),{rows,facts,news,provider:facts?.provider||'not-reported'},question,'',target);
}
