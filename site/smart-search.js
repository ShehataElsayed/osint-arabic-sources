import { BACKEND_URL, EXTERNAL_AI } from './rag-config.js';
import { $, el, startTurn, typeInto, wireComposer, NOTICE } from './chat-ui.js';
let tools, pipeline;
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const load = async () => tools || (tools = await (await fetch('./search-tools.json')).json());
// Candidates: IDF-weighted keyword match over the tool name and first sentence of its description.
function keyword(q, items) {
  const docs = items.map(t => norm(t.name + ' ' + t.description.split(/[.؛]/)[0]));
  const terms = [...new Set(norm(q).split(' ').filter(x => x.length > 3))].map(w => { const stem = w.length > 4 ? w.replace(/^(ال|و|ب|ل)/, '') : w, df = docs.filter(d => d.includes(stem)).length; return { stem, wt: df ? Math.min(2, .6 + Math.log(items.length / df) / 3) : 0 }; });
  return items.map((t, i) => ({ t, id: i, score: terms.reduce((s, x) => s + (docs[i].includes(x.stem) ? x.wt : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 24);
}
function card(t, i, extra) {
  const c = el('article', null, 'src-card fade'); c.style.animationDelay = (i * 0.12) + 's';
  c.append(el('strong', t.name));
  for (const [label, txt] of extra || []) { const p = el('p', null, 'tool-line'); p.append(el('b', label + ' '), document.createTextNode(txt)); c.append(p); }
  c.append(el('small', t.description));
  const a = el('a', 'افتح الأداة ↗'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.osintTool = t.name; c.append(a);
  return c;
}
async function semantic(q, cands) {
  if (!pipeline) { const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm'); pipeline = await mod.pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { dtype: 'q8' }); }
  const vs = []; for (const s of [q, ...cands.map(x => `${x.t.name}: ${x.t.description}`)]) vs.push((await pipeline(s, { pooling: 'mean', normalize: true })).data);
  return cands.map((c, i) => ({ ...c, sem: vs[0].reduce((s, v, k) => s + v * vs[i + 1][k], 0) })).sort((a, b) => b.sem - a.sem);
}
let last = null;
async function ask(q) {
  $('greet').hidden = true; const body = startTurn($('thread'), q);
  const all = await load(), cands = keyword(q, all).filter(x => x.score > 0).slice(0, 15); last = { q, cands };
  body.replaceChildren(); const title = el('h3', null, 'answer-title'); body.append(title);
  if (!cands.length) { await typeInto(title, 'لا توجد أدوات مطابقة داخل الدليل، جرّب كلمات أخرى.'); return; }
  let picks = null;
  if (EXTERNAL_AI && BACKEND_URL) {
    try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'recommend', query: q, candidates: cands.map(x => ({ id: x.id, name: x.t.name, description: x.t.description })) }) }); picks = r.ok ? (await r.json()).picks : null; } catch { /* keyword fallback */ }
  }
  if (Array.isArray(picks) && picks.length) {
    await typeInto(title, 'هذه أنسب الأدوات في الدليل لسؤالك:');
    picks.forEach((k, i) => { const t = all[k.id]; if (t) body.append(card(t, i, [['لماذا هذه الأداة؟', k.why], ['كيف تستخدمها؟', k.how]])); });
    body.append(el('p', 'الترشيح من أدوات الدليل فقط، والروابط من قاعدة الدليل نفسها. افحص كل أداة ومصدرها قبل الاعتماد عليها.', 'meta-line fade'));
  } else {
    await typeInto(title, EXTERNAL_AI ? 'تعذّر الترشيح الآن، وهذه أقرب الأدوات بالكلمات:' : 'أقرب الأدوات بالكلمات:');
    cands.slice(0, 8).forEach((x, i) => body.append(card(x.t, i)));
  }
}
wireComposer({ form: $('composer'), input: $('q'), send: $('send'), chips: [...document.querySelectorAll('.chip')], onAsk: async q => { try { await ask(q); } catch (e) { startTurn($('thread'), q).replaceChildren(el('p', 'تعذّر إكمال الطلب: ' + e.message, 'why')); } } });
$('local').onclick = async () => {
  if (!last) { $('status').textContent = 'اسأل أولًا ثم رتّب النتائج.'; return; }
  $('status').textContent = 'جارٍ تنزيل نموذج صغير يعمل على جهازك (مرة واحدة)...';
  try { const r = await semantic(last.q, last.cands), body = startTurn($('thread'), 'ترتيب دلالي على جهازي'); body.replaceChildren(el('h3', 'ترتيب دلالي تجريبي من نموذج يعمل على جهازك:', 'answer-title')); r.slice(0, 6).forEach((x, i) => body.append(card(x.t, i))); $('status').textContent = ''; }
  catch (e) { $('status').textContent = 'تعذر تشغيل النموذج على هذا الجهاز: ' + e.message; }
};
if (EXTERNAL_AI) $('notice').textContent = NOTICE;
