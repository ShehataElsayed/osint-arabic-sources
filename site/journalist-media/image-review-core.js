// Rule-based verification questions from image metadata (original spec #7,
// nonAI part: اقتراح قرائن وأسئلة للتحقق). Questions come from the
// presence/absence of metadata only - they are leads for the journalist,
// never judgments about the image.
export function verificationQuestions(result){
 if(!result||typeof result!=='object')throw Error('نتيجة غير صالحة');
 const q=[],f=result.fields||{},w=Array.isArray(result.warnings)?result.warnings:[];
 if(w.some(x=>x.includes('EXIF')||x.includes('eXIf')||x.includes('الوصفية')))
  q.push('لا بيانات وصفية في الملف: اطلب الأصل أو نسخة أقدم، وابحث عن أول ظهور معروف للصورة.');
 if(f.software)q.push('برنامج تعديل مسجل ('+f.software+'): ما الذي عُدّل؟ اطلب النسخة قبل التحرير.');
 if(result.gps&&Number.isFinite(result.gps.lat))
  q.push('إحداثيات مضمّنة: قارنها بالمكان المدعى، وتذكّر أنها قابلة للكتابة لاحقًا ولا تثبت المكان.');
 if(f.captured)q.push('تاريخ التقاط مدعى ('+f.captured+'): قارنه بزمن نشر الادعاء؛ التاريخ يكتبه الجهاز ويمكن تعديله.');
 if(f.captured&&f.modified&&f.captured!==f.modified)
  q.push('تاريخ الالتقاط يختلف عن تاريخ آخر تعديل: ما الذي تغيّر بينهما؟');
 if(f.make||f.model)q.push('جهاز مسجل ('+[f.make,f.model].filter(Boolean).join(' ')+'): هل يتفق مع الجهاز المتوقع للمصدر؟');
 if(!q.length)q.push('لا قرائن وصفية كافية لتوليد أسئلة محددة؛ قارن الأبعاد والبصمة بأي نسخة منشورة يدويًا.');
 return q}
