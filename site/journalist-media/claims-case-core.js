import {validateCase} from '../journalist-core.js';
export function claimsCase(review,base={format:'journalist-workbench-v1',title:'مراجعة ادعاءات موثقة',sources:[],records:[]}){
 if(!review||review.format!=='claims-review-v1'||typeof review.source?.text!=='string'||!Array.isArray(review.items))throw Error('قائمة مراجعة غير صالحة');
 const out=validateCase(base),source={id:'CLAIM-'+crypto.randomUUID(),title:review.source.title||'مصدر رصد الادعاءات',url:review.source.url||'',text:review.source.text};out.sources.push(source);
 for(const [i,item]of review.items.entries()){
  if(!Number.isInteger(item.start)||!Number.isInteger(item.end)||source.text.slice(item.start,item.end)!==item.sentence||!['unreviewed','accepted','rejected'].includes(item.review))throw Error('اقتباس أو مراجعة غير مطابق');
  out.records.push({id:crypto.randomUUID(),tool:'claims',title:item.sentence.slice(0,140),note:'مرشح بقواعد لغوية، لا حكم بصحته.\nإشارات: '+item.signals.join('، ')+'\nحدود السياق: '+item.context.join('، ')+'\nالدليل الناقص: '+item.missingEvidence.join(' | ')+'\nملاحظات المراجع: '+(item.note||''),review:item.review,anchors:[{sourceId:source.id,start:item.start,end:item.end,quote:item.sentence}],claimReview:{direction:item.direction||'unknown',evidence:item.evidence||'',originalIndex:i}});
 }
 return validateCase(out);
}
