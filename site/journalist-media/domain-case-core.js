import {validateCase} from '../journalist-core.js';
// Input is data only. No fetch, URL navigation, evaluation or identity inference.
export async function importDomain(originalText,current={format:'journalist-workbench-v1',title:'أدلة ملف النطاق',sources:[],records:[]}){
 if(typeof originalText!=='string'||new TextEncoder().encode(originalText).length>2000000)throw Error('Domain import must be UTF-8 JSON at most 2MB');
 const input=JSON.parse(originalText);
 if(!input||input.format!=='domain-dossier-v1'||typeof input.hostname!=='string'||!input.hostname||!Array.isArray(input.records)||!input.records.length||input.records.length>50)throw Error('Incompatible domain dossier');
 if(input.reviewState!=='manual-review-required')throw Error('Unsupported dossier review state');
 const result=validateCase(current),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(originalText))),v=>v.toString(16).padStart(2,'0')).join('');
 if(result.domainImports!==undefined&&!Array.isArray(result.domainImports))throw Error('Incompatible import archive');
 if(result.domainImports?.some(x=>x.sha256===hash))throw Error('This exact dossier is already imported');
 const newSources=[],newRecords=[];
 input.records.forEach((r,i)=>{
  if(!r||typeof r.title!=='string'||r.title.length>500||typeof r.summary!=='string'||typeof r.raw!=='string'||!r.raw.length||typeof r.source!=='string'||r.source.length>2000||typeof r.accessed!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.accessed)||!Number.isFinite(Date.parse(r.accessed)))throw Error('Incompatible domain record '+i);
  const endpoint=new URL(r.source);if(!['https:','http:'].includes(endpoint.protocol))throw Error('Unsupported source endpoint '+i);
  if(r.review!==undefined&&!['unreviewed','accepted','rejected'].includes(r.review))throw Error('Unsupported record review state '+i);
  const anchors=[];
  for(let start=0;start<r.raw.length;start+=30000){const text=r.raw.slice(start,start+30000),id='DOMAIN-'+hash.slice(0,24)+'-'+i+'-'+start;
   newSources.push({id,title:r.title,url:r.source,text});anchors.push({sourceId:id,start:0,end:text.length,quote:text});}
  if(anchors.length>20)throw Error('Raw record exceeds shared-case anchor capacity; original preserved outside case');
  newRecords.push({id:'DOMAIN-'+hash.slice(0,24)+'-'+i,tool:'domain',title:r.title,note:`النطاق كما سُجل: ${"\u2066"+input.hostname+"\u2069"}\nوقت الوصول كما سُجل: ${"\u2066"+r.accessed+"\u2069"}\nالمصدر كما سُجل: ${"\u2066"+r.source+"\u2069"}\n${r.summary}\nاستيراد سجل فقط، لا تحقق جديد ولا إثبات لهوية المشغل.`,review:r.review||'unreviewed',anchors,domainEvidence:{importSha256:hash,recordIndex:i,endpoint:r.source,accessed:r.accessed,hostname:input.hostname,originalReviewState:input.reviewState,originalRecordReview:r.review??null,rawUtf16Length:r.raw.length}});
 });
 result.sources.push(...newSources);result.records.push(...newRecords);
 result.domainImports=[...(result.domainImports||[]),{format:input.format,sha256:hash,encoding:'utf-8',originalText}];
 // All-or-nothing: legacy capacities reject rather than truncate or skip evidence.
 return validateCase(result);
}
