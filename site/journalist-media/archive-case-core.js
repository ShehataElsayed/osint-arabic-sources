import{validateCase}from'../journalist-core.js';
export function archiveCase(result,review,note,base={format:'journalist-workbench-v1',title:'بيانات أرشيف للمراجعة',sources:[],records:[]}){
 if(!result?.queriedUrl||!Array.isArray(result.rawResponses)||!result.rawResponses.length)throw Error('لا استجابة أصلية محفوظة');
 const out=validateCase(base),anchors=[];
 for(const [i,response] of result.rawResponses.entries()){if(typeof response.text!=='string')throw Error('استجابة ناقصة');for(let start=0;start<response.text.length;start+=30000){const text=response.text.slice(start,start+30000),s={id:'ARCH-'+crypto.randomUUID(),title:'استجابة بيانات الأرشيف '+(i+1)+'، جزء '+(start/30000+1),url:response.url,text};out.sources.push(s);anchors.push({sourceId:s.id,start:0,end:text.length,quote:text})}}
 for(let i=0;i<anchors.length;i+=20)out.records.push({id:crypto.randomUUID(),tool:'archive',title:'بيانات لقطات: '+result.queriedUrl,note:'بيانات واجهة الأرشيف فقط، ليست محتوى الصفحة ولا إثبات صحة. أجزاء الاستجابة تحفظ ترتيبها دون حذف.\nملاحظات المراجع: '+note,review,anchors:anchors.slice(i,i+20),archiveObservation:{queriedUrl:result.queriedUrl,estimatedTotal:result.estimatedTotal,captures:structuredClone(result.captures),responses:result.rawResponses.map(r=>({url:r.url,fetchedAt:r.fetchedAt})),limits:result.limits}});
 return validateCase(out);
}
