/* Explicit local backup. Restore is additive and validated before any write. */
import{KINDS,uid,safeDocumentHtml}from'./kernel.js';
export const BACKUP_FORMAT='osh-office-workspace-v1';
const fail=()=>{throw Error('ملف النسخة غير صالح أو يتجاوز الحدود المدعومة. لم يتغير أي ملف.')};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const array=(x,max)=>{if(!Array.isArray(x)||x.length>max)fail();return x};
export function validateFile(input){
 if(!object(input)||!Object.hasOwn(KINDS,input.kind)||typeof input.name!=='string'||!input.name.trim()||input.name.length>500||!object(input.data))fail();
 const f=structuredClone(input),d=f.data;
 const scan=(v,depth=0)=>{if(depth>40)fail();if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))fail();scan(x,depth+1)}};scan(f);
 const safeStyle=o=>{if(!object(o))return;for(const v of Object.values(o))if(typeof v==='string'&&/url\s*\(|expression|[<>]/i.test(v))fail()};
 if(f.kind==='doc'){if(typeof d.html!=='string'||!object(d.settings))fail();d.html=safeDocumentHtml(d.html)}
 if(f.kind==='sheet'){array(d.sheets,100);if(!d.sheets.length||!Number.isInteger(d.active)||!d.sheets[d.active])fail();for(const s of d.sheets){if(!object(s)||typeof s.name!=='string'||!object(s.cells)||!object(s.colW)||!object(s.rowH))fail();for(const[k,c]of Object.entries(s.cells)){if(!/^\d+,\d+$/.test(k)||!object(c)||c.f&&typeof c.f!=='string'||c.v!=null&&!['string','number','boolean'].includes(typeof c.v))fail()}}}
 if(f.kind==='deck'){array(d.slides,1000);if(!d.slides.length||!object(d.theme))fail();for(const s of d.slides){if(!object(s)||typeof(s.notes||'')!=='string')fail();safeStyle(s.bg);array(s.elements,5000);for(const e of s.elements){if(!object(e)||!['text','image','shape','table'].includes(e.type)||!['x','y','w','h'].every(k=>Number.isFinite(e[k])))fail();safeStyle(e.style);if(e.type==='image'&&!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(e.src||''))fail();if(e.type==='text'&&typeof e.text!=='string')fail();if(e.type==='table')for(const r of array(e.rows,1000))array(r,200).forEach(c=>{if(typeof c!=='string')fail()})}}}
 if(f.kind==='board'){for(const l of array(d.lists,1000)){if(!object(l)||typeof l.title!=='string'||typeof l.id!=='string')fail();for(const c of array(l.cards,10000)){if(!object(c)||typeof c.title!=='string'||typeof c.id!=='string')fail();for(const k of ['desc','due','pr'])if(c[k]!=null&&typeof c[k]!=='string')fail();for(const x of array(c.labels||[],1000))if(typeof x!=='string')fail();for(const x of array(c.check||[],1000))if(!object(x)||typeof x.text!=='string'||typeof x.done!=='boolean')fail()}}}
 return f;
}
export function parseBackup(text){if(typeof text!=='string'||text.length>50*1024*1024)fail();let v;try{v=JSON.parse(text)}catch{fail()}if(v.format!==BACKUP_FORMAT||v.version!==1)fail();const files=array(v.files,1000).map(validateFile);return files.map(f=>({...f,id:uid(),restoredAt:Date.now(),restoredFrom:f.id||null,updated:Date.now()}))}
export function workspaceBackup(files){return {format:BACKUP_FORMAT,version:1,exportedAt:new Date().toISOString(),files}}
