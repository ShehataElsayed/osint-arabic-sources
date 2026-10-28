import{validateCase}from'../journalist-core.js';
export function plannerCase(plan,description,reviews,base={format:'journalist-workbench-v1',title:'خطة تحقق للمراجعة',sources:[],records:[]}){
 if(!plan?.steps?.length||typeof description!=='string')throw Error('خطة غير صالحة');const out=validateCase(base),source={id:'PLAN-'+crypto.randomUUID(),title:'وصف القضية المدخل (ليس دليلًا)',url:'',text:description};out.sources.push(source);
 for(const step of plan.steps){const review=reviews.find(r=>r.order===step.order)||{review:'unreviewed',note:''};out.records.push({id:crypto.randomUUID(),tool:'planner',title:step.order+'. '+step.tool,note:'اقتراح قواعد من وصف المدخل، ليس تنفيذًا أو دليلًا.\nالمدخلات: '+step.input+'\nالخطوات المقترحة: '+step.steps.join(' | ')+'\nالناتج المتوقع: '+step.expected+'\nشرط التوقف: '+step.stop+'\nملاحظات مراجعة الخطة: '+review.note,review:review.review,anchors:description?[{sourceId:source.id,start:0,end:description.length,quote:description}]:[],planStep:{...structuredClone(step),review:structuredClone(review)},planContext:{materials:plan.materials,notes:plan.notes,external:plan.external}})}
 return validateCase(out);
}
