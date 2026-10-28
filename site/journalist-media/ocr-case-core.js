import {validateCase} from '../journalist-core.js';
export function ocrCase(ocr,base={format:'journalist-workbench-v1',title:'نص مستخرج ومراجع أمام الصورة',sources:[],records:[]}){
 if(typeof ocr?.rawText!=='string'||typeof ocr.reviewedText!=='string'||!ocr.rawText||!ocr.image?.sha256||!['unreviewed','accepted','rejected'].includes(ocr.review))throw Error('استخراج غير صالح');
 const out=validateCase(base),s={id:'OCR-'+crypto.randomUUID(),title:ocr.title||ocr.image.name||'نص الصورة المستخرج',url:ocr.url||'',text:ocr.rawText};out.sources.push(s);
 out.records.push({id:crypto.randomUUID(),tool:'ocr',title:'مراجعة OCR: '+s.title,note:'هذا نص محرك OCR من صورة، وليس مصدرًا مستقلًا أو دليل تأييد.\nالصورة الأصلية ليست مضمّنة في ملف القضية؛ احتفظ بها للمراجعة.\nتعديلات المراجع منفصلة ولا تستبدل النص المستخرج.\nملاحظات المراجع: '+(ocr.note||''),review:ocr.review,anchors:[{sourceId:s.id,start:0,end:s.text.length,quote:s.text}],ocrReview:structuredClone(ocr)});
 return validateCase(out);
}
