import {validateCase,validDate} from '../journalist-core.js';
export function timelineCase(events,base={format:'journalist-workbench-v1',title:'خط زمني مع مصادره',sources:[],records:[]}){
 if(!Array.isArray(events)||!events.length)throw Error('لا أحداث للتصدير');
 const out=validateCase(base),sourceIds=new Map;
 for(const e of events){
  if(typeof e.text!=='string'||e.text.length>500||(e.date&&!validDate(e.date)))throw Error('حدث غير صالح');
  const anchors=[];
  if(e.source){const s=e.source,a=e.anchor;if(!s.id||!a||!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end<a.start||s.text.slice(a.start,a.end)!==e.quote)throw Error('اقتباس غير مطابق');
   const fingerprint=JSON.stringify(s);let sourceId=sourceIds.get(fingerprint);if(!sourceId){sourceId='TL-'+crypto.randomUUID();out.sources.push({...s,id:sourceId});sourceIds.set(fingerprint,sourceId)}
   anchors.push({sourceId,start:a.start,end:a.end,quote:e.quote});
  }
  out.records.push({id:crypto.randomUUID(),tool:'timeline',title:e.text,note:'التاريخ المدخل: '+(e.date||'غير محسوم')+'\nالتعبير الأصلي: '+(e.raw||'يدوي')+'\nالحسم والتحرير بقرار بشري، لا تحقق آلي من تاريخ الحدث.\n'+(!anchors.length?'حدث بلا مصدر حرفي موثق. النص المستورد أو اليدوي ليس اقتباسًا مثبتًا.\n':'')+'ملاحظات المراجع: '+(e.note||''),review:e.review||'unreviewed',anchors,timelineEvent:structuredClone(e)});
 }
 return validateCase(out);
}
export function validateEvents(raw){
 if(raw?.format!=='timeline-events-v1'||!Array.isArray(raw.events)||raw.events.length>500||JSON.stringify(raw).length>5000000)throw Error('ملف أحداث غير صالح');
 if(raw.events.length)timelineCase(raw.events);
 return structuredClone(raw.events).map(e=>({...e,date:e.date||'',quote:e.quote||'',raw:e.raw||'',review:e.review||'unreviewed',note:e.note||''}));
}
