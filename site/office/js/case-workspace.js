/* Personal case continuity. No team identities, approvals or publication effects. */
import{newFile,esc}from'./kernel.js';
export const CASE_STEPS=['تحديد سؤال القضية','تسجيل المصادر الأصلية','مراجعة الاقتباسات والسياق','مراجعة البيانات والأرقام','مراجعة مسودة النص','تجهيز ملفات التسليم'];
export function newCase(title,question=''){const f=newFile('doc',title);f.caseWorkspace={version:1,question,notes:'',checklist:CASE_STEPS.map(text=>({text,done:false}))};f.data.html='<h1>'+esc(title)+'</h1><p>مساحة قضية شخصية محلية، ليست موافقة تحريرية أو نشراً.</p><p>'+esc(question)+'</p>';return f}
export function casesFrom(files){return files.filter(f=>f.caseWorkspace?.version===1)}
export function caseMembers(files,id){return files.filter(f=>f.id===id||f.caseId===id)}
export function caseSources(files,id){const out=[],seen=new Set();for(const f of caseMembers(files,id)){const sources=[...(f.provenanceCase?.sources||[]),...(f.aiProvenance?.result?.sources||[])];if(f.aiProvenance?.sourceUrl)sources.push({url:f.aiProvenance.sourceUrl,title:'صفحة النتيجة الأصلية'});for(const s of sources){if(!s?.url||seen.has(s.url))continue;seen.add(s.url);out.push({url:s.url,title:s.title||s.name||s.url,fileName:f.name})}}return out}
