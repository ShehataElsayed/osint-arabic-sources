import {validateCase} from '../journalist-core.js';
export function entitiesCase(data,base={format:'journalist-workbench-v1',title:'رصد صيغ وتزامن موثق',sources:[],records:[]}){
 if(data?.format!=='entities-review-v1'||!Array.isArray(data.documents)||!Array.isArray(data.entities))throw Error('رصد غير صالح');
 const out=validateCase(base),sources=data.documents.map((d,i)=>({id:'ENT-'+crypto.randomUUID(),title:d.title||'وثيقة '+(i+1),text:d.text,url:d.url||''}));out.sources.push(...sources);
 for(const entity of data.entities){const anchors=entity.mentions.map(m=>{const source=sources[m.doc-1];if(!source||!Number.isInteger(m.start)||!Number.isInteger(m.end)||source.text.slice(m.start,m.end)!==m.quote)throw Error('ورود غير مطابق');return{sourceId:source.id,start:m.start,end:m.end,quote:m.quote}});
  // Split long mention sets, never truncate at the case's twenty-anchor limit.
  for(let i=0;i<anchors.length;i+=20)out.records.push({id:crypto.randomUUID(),tool:'entities',title:entity.surface,note:'مرشح تكرار سطحي، لا هوية مثبتة ولا علاقة.\nحالة الصيغة: '+entity.status+'\nالهوية: '+entity.identity+'\nمواضع الورود '+(i+1)+'-'+Math.min(i+20,anchors.length)+' من '+anchors.length+'\nقرارات المراجع محفوظة كما وردت في بيانات الرصد؛ الدمج البشري ليس مصادقة آلية.',review:entity.status==='dismissed'?'rejected':'unreviewed',anchors:anchors.slice(i,i+20),entityReview:{...structuredClone(entity),mentions:entity.mentions.slice(i,i+20)},entityContext:{clusters:data.clusters,decisions:data.decisions,cooccurrence:data.cooccurrence}});
 }
 return validateCase(out);
}
