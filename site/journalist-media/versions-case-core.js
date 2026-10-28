import {validateCase} from '../journalist-core.js';
export function versionsCase(diff,base={format:'journalist-workbench-v1',title:'مقارنة نسختين موثقتين',sources:[],records:[]}){
 if(diff?.format!=='versions-diff-v1'||!Array.isArray(diff.ops)||!diff.sources?.every(s=>typeof s.text==='string')||diff.sources.length!==2)throw Error('مقارنة غير صالحة');
 const out=validateCase(base),sources=diff.sources.map((s,i)=>({id:'VER-'+crypto.randomUUID(),title:s.title||'النسخة '+(i+1),url:s.url||'',text:s.text}));
 out.sources.push(...sources);
 const lines=sources.map(s=>{let start=0;return s.text.split('\n').map(quote=>{const span={sourceId:s.id,start,end:start+quote.length,quote};start+=quote.length+1;return span})});
 for(const op of diff.ops){if(op.type==='same')continue;const anchors=[];if(op.aLine!==undefined){if(!lines[0][op.aLine-1])throw Error('سطر أصل غير صالح');anchors.push(lines[0][op.aLine-1])}if(op.bLine!==undefined){if(!lines[1][op.bLine-1])throw Error('سطر نسخة غير صالح');anchors.push(lines[1][op.bLine-1])}
 out.records.push({id:crypto.randomUUID(),tool:'versions',title:({mod:'تعديل سطر',add:'إضافة سطر',del:'حذف سطر'})[op.type]||'اختلاف',note:'مقارنة سطرية فقط، لا حكم بتغير المعنى أو صحة الأرقام.\nتجاهل المسافات أثناء المقارنة: '+(diff.options.ignoreWhitespace?'نعم':'لا')+'\nاقتباسات القضية من النص الأصلي الكامل، لا النص المطبّع.\nحركة الفقرات قد تظهر حذفًا وإضافة.',review:'unreviewed',anchors,versionChange:{...op}});
 }
 return validateCase(out);
}
