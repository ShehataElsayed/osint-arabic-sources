// Pure Markdown report builders for مساعد NewsRAG. No DOM, no network: fully testable.
const line = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const DISCLOSURE = 'هذا التقرير ناتج آلي مساعد للتحقق وليس دليل نشر. معرّفات الإحالة تتحقق من وجود المقطع لا من صحة الادعاء. راجع المصادر الأصلية وتواريخها وسياقها قبل أي نشر.';

export function buildRagReport({ question, result, when }) {
  const r = result || {};
  const out = ['# تقرير مساعد NewsRAG — سؤال على مصادر', ''];
  out.push(`التاريخ: ${line(when) || new Date().toISOString()}`);
  out.push(`السؤال: ${line(question)}`);
  out.push(`نوع السؤال: ${line(r.type) || 'غير محدد'} · القرار: ${r.decision === 'answer' ? 'إجابة' : r.decision === 'retrieve_only' ? 'استرجاع فقط (بدون توليد)' : 'امتناع'}`);
  out.push('');
  out.push('## الإجابة');
  out.push(r.text ? r.text : 'لا توجد إجابة مولدة.');
  if (r.generated) out.push('', `صحة معرّفات الإحالة: ${r.citation_refs_valid ? 'كل المعرّفات المذكورة موجودة' : 'توجد معرّفات غير معروفة'}`);
  if (r.warnings && r.warnings.length) { out.push('', '## التحذيرات'); r.warnings.forEach(w => out.push(`- ${line(w)}`)); }
  out.push('', '## الأدلة المسترجعة');
  (r.evidence || []).forEach(e => {
    out.push(`### [${e.ref}] ${line(e.title)}`);
    out.push(`الناشر: ${line(e.publisher) || 'غير محدد'} · تاريخ النشر: ${e.published_at || 'غير معروف'} · الدرجة: ${typeof e.score === 'number' ? e.score : '—'} · المواضع: ${e.start}–${e.end}`);
    if (e.url) out.push(`الرابط: ${e.url}`);
    out.push('> ' + line(e.excerpt));
    out.push('');
  });
  if (!(r.evidence || []).length) out.push('لا أدلة.');
  out.push('', '---', DISCLOSURE);
  return out.join('\n');
}

const MARK = { pass: 'نجح', fail: 'فشل', warn: 'تحفظ', na: 'غير منطبق' };
const RELIABILITY = { very_high: 'عالية جدًا', high: 'عالية', medium: 'متوسطة', unknown: 'غير معروفة' };

export function buildVerifyReport({ question, model, confidence, when }) {
  const m = model || {};
  const out = ['# تقرير مساعد NewsRAG — ادعاء متداول', ''];
  out.push(`التاريخ: ${line(when) || new Date().toISOString()}`);
  out.push(`الادعاء: ${line(question)}`);
  out.push('');
  out.push('## إجابة النموذج (من معرفته، وليست دليلًا)');
  out.push(m.answer || 'لم يُنتج النموذج إجابة صالحة.');
  out.push(`الحكم: ${m.verdict === 'supported' ? 'مدعوم' : m.verdict === 'refuted' ? 'مرفوض' : 'غير مؤكد'} · القرار: ${m.decision === 'answer' ? 'إجابة' : 'امتناع'}`);
  if (confidence) out.push(`درجة الثقة الإرشادية: ${confidence}`);
  if (m.criteria && m.criteria.length) {
    out.push('', '## المعايير');
    m.criteria.forEach(c => out.push(`- [${MARK[c.status] || c.status}] ${line(c.label)}: ${line(c.detail)}`));
  }
  if (m.sources && m.sources.length) {
    out.push('', '## المصادر المذكورة والمفحوصة آليًا');
    m.sources.forEach(s => {
      out.push(`### ${line(s.name) || 'مصدر بلا عنوان'}`);
      out.push(`الرابط: ${s.url || line(s.claimed) || 'لم يُفتح'} · فُتح: ${s.exists ? 'نعم' : 'لا'} · موثوقية الجهة (تقدير عام): ${RELIABILITY[s.rel] || RELIABILITY.unknown} · دعم الادعاء: ${s.verified ? 'اجتاز الفحص' : 'لم يتحقق'}`);
      if (s.quote) out.push('> ' + line(s.quote));
      out.push('');
    });
  }
  out.push('', '---', DISCLOSURE, 'معرفة النموذج ليست دليلًا، وموثوقية الجهة تقدير عام لا يثبت صحة هذا الادعاء.');
  return out.join('\n');
}
