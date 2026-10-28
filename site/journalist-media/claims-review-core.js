// Missing-evidence hints per claim (original spec #1: توضيح الدليل الناقص).
// Pure heuristics over the page's own signal vocabulary. These say what is
// NOT present in the sentence; they never say the claim is false.
export function missingEvidence({signals=[],context=[]}={}){
 if(!Array.isArray(signals)||!Array.isArray(context))throw Error('إشارات غير صالحة');
 const out=[];
 if(!signals.includes('نسبة قول إلى مصدر'))out.push('لا مصدر منسوب للقول - ابحث عمن أدلى به أصلًا');
 if(!signals.includes('اقتباس منقول'))out.push('لا اقتباس حرفي موثق - الصياغة قد تكون إعادة تلخيص');
 if(!signals.includes('أرقام')&&!signals.includes('تاريخ أو زمن'))out.push('لا رقم ولا تاريخ يرسّخان الادعاء - حدد ما يمكن قياسه أو توقيته');
 if(context.includes('صيغة افتراضية أو احتمالية'))out.push('صيغة احتمالية - القول لم يُقدَّم كواقعة مؤكدة بعد');
 if(context.includes('صيغة نفي'))out.push('صيغة نفي - تحقق مما نُفي بالضبط ومن نفاه');
 return out}
