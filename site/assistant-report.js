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

const BAND_LBL = { high: 'تغطية فحوص مرتفعة', mid: 'تغطية فحوص متوسطة', low: 'تغطية فحوص منخفضة' };
const DECISION_LBL = { answer: 'إجابة بعد الفحص', extractive: 'مقتطفات موثقة فقط', insufficient: 'أدلة غير كافية' };
const TIER_LBL = { very_high: 'جهة رسمية (تصنيف نطاق)', high: 'جهة معروفة (تصنيف نطاق)', medium: 'هوية موثقة جزئيًا', unknown: 'غير مُقيَّمة' };

export function buildAskReport({ question, result, catalog, when }) {
  const r = result || {};
  const conf = r.confidence || { score: 0, band: 'low', criteria: [] };
  const out = ['# تقرير مساعد NewsRAG — سؤال وجواب', ''];
  out.push(`التاريخ: ${line(when) || new Date().toISOString()}`);
  out.push(`السؤال: ${line(question)}`);
  out.push(`نوع النتيجة: ${DECISION_LBL[r.decision] || 'إجابة بعد الفحص'}`);
  out.push(`مؤشر تغطية الفحوص الآلي: ${Math.round(conf.score)}/100 نقطة — ${BAND_LBL[conf.band] || conf.band} (متوسط ${(conf.criteria || []).length} معايير معلنة، كل معيار 0/0.5/1؛ يقيس تغطية الفحوص لا احتمال الصحة ولا الموثوقية)`);
  out.push('', r.decision === 'insufficient' ? '## لم تُعرض إجابة: الأدلة المفتوحة غير كافية' : '## الإجابة بعد الفحص');
  out.push(r.answer || '—');
  if ((r.claims || []).length) {
    out.push('', '## سند الادعاءات (تطابق نصي، لا إثبات استدلالي)');
    r.claims.forEach(c => {
      out.push(`- [${c.supported ? 'له سند نصي' : 'لا سند نصي'}] ${line(c.text)}`);
      if (c.supported && c.evidence) out.push(`  السند: "${line(c.evidence)}" (المصدر [${c.source_ref}])`);
    });
  }
  if ((conf.criteria || []).length) {
    out.push('', '## معايير مؤشر الثقة');
    conf.criteria.forEach(c => out.push(`- (${c.score}/1) ${c.label}: ${line(c.detail)}`));
  }
  const srcs = r.sources || [];
  if (srcs.length) {
    out.push('', '## المصادر');
    srcs.forEach((s, i) => {
      out.push(`### [${i + 1}] ${line(s.title || s.name || s.url || s.claimed)}`);
      out.push(`الجهة: ${TIER_LBL[s.rel] || 'غير مُقيَّمة'} (تصنيف نطاق، لا تقييم دقة) · الحالة: ${s.exists ? 'فُتح وتحقق' : 'تعذر الفتح'} · الرابط: ${s.exists ? s.url : (s.claimed || '—')}`);
      if (s.repaired && s.original) out.push(`صُحّح الرابط من: ${s.original}`);
      if (s.exists && s.quote) out.push('> ' + line(s.quote));
      out.push('');
    });
  }
  if ((r.factcheck || []).length) { out.push('', '## قاعدة مدققي الحقائق'); r.factcheck.forEach(x => out.push(`- ${line(x.rating ? x.rating + ' — ' : '')}${line(x.title)} (${x.url})`)); }
  if ((r.issues || []).length) { out.push('', '## الإشكاليات'); r.issues.forEach(t => out.push(`- ${line(t)}`)); }
  if ((r.angles || []).length) { out.push('', '## زوايا صحفية'); r.angles.forEach(t => out.push(`- ${line(t)}`)); }
  const cat = Array.isArray(catalog) ? catalog : [];
  if ((r.tools || []).length) {
    out.push('', '## أدوات من الدليل');
    r.tools.forEach(p => { const t = cat[p.id]; out.push(`- ${line(t ? t.name : 'أداة')} — ${t ? t.url : ''}${p.why ? ' | ' + line(p.why) : ''}`); });
  }
  if ((r.warnings || []).length) { out.push('', '## التحذيرات'); r.warnings.forEach(w => out.push(`- ${line(w)}`)); }
  out.push('', '---', DISCLOSURE);
  return out.join('\n');
}
