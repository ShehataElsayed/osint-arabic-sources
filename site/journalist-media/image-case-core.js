import{validateCase}from'../journalist-core.js';
export function imageCase(observation,context,base={format:'journalist-workbench-v1',title:'مراجعة بيانات صورة',sources:[],records:[]}){
 if(!observation?.file?.sha256)throw Error('افحص الصورة أولًا');const out=validateCase(base),raw=JSON.stringify(observation,null,2),anchors=[];
 for(let start=0;start<raw.length;start+=30000){const text=raw.slice(start,start+30000),s={id:'IMAGE-'+crypto.randomUUID(),title:(context.title||observation.file.name)+'، سجل فحص جزء '+(start/30000+1),url:context.url||'',text};out.sources.push(s);anchors.push({sourceId:s.id,start:0,end:text.length,quote:text})}
 for(let i=0;i<anchors.length;i+=20)out.records.push({id:crypto.randomUUID(),tool:'image',title:context.title||observation.file.name,note:'سجل فحص محلي، ليس حكم أصالة. بيانات الملف قابلة للتعديل، والمؤشرات البصرية تحتاج مراجعة. الصورة الأصلية وطبقات العرض غير مضمنة، احتفظ بالأصل وبصمته. إعدادات العرض التفاعلية اللاحقة لا تغير سجل التحليل الأساسي.\nملاحظات المراجع: '+context.note,review:context.review,anchors:anchors.slice(i,i+20),imageObservation:structuredClone(observation)});return validateCase(out);
}
