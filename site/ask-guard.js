// حارس استجابة المساعد: لا نعرض أبدًا «إجابة» فارغة جاءت من شكل استجابة غير متوقع.
// قد يتأخر الخادم المنشور عن مسار ask في الموقع (فيعيد شكلًا قديمًا مثل
// {results, factcheck_enabled})؛ عرض ذلك كبطاقة «الإجابة بعد الفحص» فارغة
// يقدّم عطلًا تقنيًا وكأنه إجابة مفحوصة، وهذا أسوأ من لا شيء.
export function askResponseProblem(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'bad_shape';
  const known = ['decision', 'answer', 'sources', 'confidence', 'completeness', 'claims', 'insufficient_reason'];
  if (!known.some(k => k in data)) return 'bad_shape';
  const decision = data.decision || 'answer';
  if (decision !== 'insufficient') {
    const hasText = typeof data.answer === 'string' && data.answer.trim().length > 0;
    const hasSource = Array.isArray(data.sources) && data.sources.some(s => s && s.exists);
    if (!hasText && !hasSource) return 'empty_answer';
  }
  return null;
}

export function askProblemMessage(problem) {
  if (problem === 'empty_answer') {
    return 'وصلت من الخادم نتيجة فارغة: بلا نص إجابة ولا مصدر مفتوح واحد، فلم تُعرض كإجابة مفحوصة. هذا خلل في الخدمة لا يعني غياب المعلومة — أعد المحاولة بعد قليل، أو أكمل البحث بأدوات الدليل.';
  }
  return 'الخدمة الخلفية للمساعد لا تطابق هذا الإصدار من الموقع حاليًا، فلم تصل نتيجة صالحة للفحص والعرض. هذا خلل تقني لا يعني غياب المعلومة — أكمل البحث بأدوات الدليل إلى أن يُصلَح الخادم.';
}
