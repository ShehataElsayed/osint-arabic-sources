/* Local SQL result routing. No AI inference and no lossy TSV intermediary. */
import {newFile,putFile} from './kernel.js';
export function sqlCell(value,type={}){
 if(value!=null&&Number.isInteger(type.scale)&&type.scale>=0){const raw=String(value),negative=raw.startsWith('-'),digits=raw.replace(/^-/,'').padStart(type.scale+1,'0');return {v:(negative?'-':'')+(type.scale?digits.slice(0,-type.scale)+'.'+digits.slice(-type.scale):digits),sqlType:'decimal',sqlScale:type.scale}}
 if(value==null)return {v:'',sqlType:'null'};
 if(typeof value==='bigint')return {v:String(value),sqlType:'bigint'};
 if(typeof value==='number')return Number.isFinite(value)?{v:value,sqlType:'number'}:{v:String(value),sqlType:'number-nonfinite'};
 if(typeof value==='boolean')return {v:value,sqlType:'boolean'};
 if(value instanceof Date)return {v:value.toISOString(),sqlType:'date'};
 if(typeof value==='object')return {v:JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v),sqlType:'json'};
 return {v:String(value),sqlType:'string'};
}
export async function captureSQLResult({columns,rows,query,fileName,types=[]}){
 if(!Array.isArray(columns)||!columns.length||!Array.isArray(rows)||columns.length*(rows.length+1)>200000)throw Error('النتيجة أكبر من حد تحويل مكتب أوش (٢٠٠ ألف خلية)؛ النتيجة الكاملة باقية في المختبر.');
 const f=newFile('sheet','نتيجة SQL - '+fileName),cells=f.data.sheets[0].cells;
 columns.forEach((v,c)=>{cells[`1,${c+1}`]={v:String(v),sqlType:'column'}});
 rows.forEach((row,r)=>row.forEach((v,c)=>{cells[`${r+2},${c+1}`]=sqlCell(v,types[c]||{})}));
 f.sqlProvenance={version:1,query,fileName,columns:columns.map((name,i)=>({name,type:types[i]?.name||'unknown'})),rowCount:rows.length,sourceUrl:location.href,createdAt:new Date().toISOString(),review:'unreviewed',limits:'Local query output, not source verification. SQL null is an empty cell with sqlType=null; bigint is exact text. Original input file is not embedded.'};
 const meta=newFile('sheet').data.sheets[0];meta.name='سياق الاستعلام';const details=[['الحقل','القيمة'],['الملف المحلي',fileName],['الاستعلام',query],['عدد الصفوف',rows.length],['حالة المراجعة','لم تُراجع؛ ليست تحققًا من المصدر'],['الأصل','الملف الأصلي غير مضمن في هذه النسخة'],['أنواع دقيقة','BIGINT وDECIMAL نص دقيق؛ NULL خلية فارغة مع sqlType=null'],...columns.map((n,i)=>['نوع '+n,types[i]?.name||'unknown'])];details.forEach((row,r)=>row.forEach((v,c)=>{meta.cells[`${r+1},${c+1}`]={v}}));f.data.sheets.push(meta);
 await putFile(f);return f;
}
