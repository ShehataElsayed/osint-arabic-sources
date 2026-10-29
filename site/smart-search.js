import { BACKEND_URL, EXTERNAL_AI } from './rag-config.js';
import { $, el, startTurn, typeInto, wireComposer, NOTICE } from './chat-ui.js';
let tools, pipeline;
import { buildIndex, search, gateScopes } from './tool-search.js';
let index;
const load = async () => tools || (tools = await (await fetch('./search-tools.json')).json());
const getIndex = items => index || (index = buildIndex(items));
function card(t, i, extra) {
  const c = el('article', null, 'src-card fade'); c.style.animationDelay = (i * 0.12) + 's';
  c.append(el('strong', t.name));
  for (const [label, txt] of extra || []) { const p = el('p', null, 'tool-line'); p.append(el('b', label + ' '), document.createTextNode(txt)); c.append(p); }
  c.append(el('small', t.description));
  const a = el('a', 'افتح الأداة ↗'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.osintTool = t.name; c.append(a);
  if (window.OSINTTaskFile) c.append(' ', window.OSINTTaskFile.button(() => ({ name: t.name, url: t.url, type: 'unknown', from: 'البحث الذكي', note: 'أداة مقترحة من البحث الذكي التجريبي. لم تُراجع بعد.' })));
  return c;
}
async function semantic(q, cands) {
  if (!pipeline) { const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm'); pipeline = await mod.pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { dtype: 'q8', revision: '2c4055b12046f11709e9df2c122e59ffbdc2f900' }); }
  const vs = []; for (const s of [q, ...cands.map(x => `${x.t.name}: ${x.t.description}`)]) vs.push((await pipeline(s, { pooling: 'mean', normalize: true })).data);
  const scored = cands.map((c, i) => ({ ...c, sem: vs[0].reduce((s, v, k) => s + v * vs[i + 1][k], 0) }));
  return gateScopes(q, fuseRanks(scored));
}
// Server-side semantic scoring: the guide's Cloudflare worker embeds the query and the candidate
// texts with bge-m3 (Workers AI) and returns one score per candidate. Throws on any failure so the
// caller can offer the explicit on-device fallback instead of silently downloading 140MB.
async function semanticServer(q, cands) {
  // The worker caps at 12 candidates; send the same slice we map scores back onto, and fuse only
  // those — the lexical list below stays complete either way.
  const top = cands.slice(0, 12);
  const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'semantic', query: q, candidates: top.map(x => ({ text: `${x.t.name}: ${x.t.description}` })) }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || !Array.isArray(j.scores) || j.scores.length !== top.length || j.scores.some(v => typeof v !== 'number')) throw new Error(j && j.error ? j.error : 'bad_response');
  const scored = top.map((c, i) => ({ ...c, sem: j.scores[i] }));
  return gateScopes(q, fuseRanks(scored));
}
function fuseRanks(scored) {
  // Reciprocal-rank fusion of the lexical order (input order) and the semantic order (k=60,
  // the literature default): a strong lexical match cannot be buried by the semantic pass,
  // and semantic evidence can still promote a better fit.
  const K = 60;
  scored.forEach((c, i) => { c.rrf = 1 / (K + i + 1); });
  [...scored].sort((a, b) => b.sem - a.sem).forEach((c, i) => { c.rrf += 1 / (K + i + 1); });
  return scored.sort((a, b) => b.rrf - a.rrf);
}
function addPlanner(body, q) {
  const pl = el('article', null, 'src-card fade'); pl.append(el('strong', 'تركيبة أدوات للقضية'), el('small', 'مخطط محلي يرتب أدوات المنصة العاملة على جهازك مع سبب كل خطوة. نموذج صغير مدرَّب على حالات اصطناعية، وترتيبه للمراجعة وليس تحققًا.')); const a = el('a', 'خطّط لقضيتي ↗'); a.href = './tools/workflows.html#planner'; a.addEventListener('click', () => { try { sessionStorage.setItem('oshai_case', q); } catch (e) { /* planner opens empty */ } }); pl.append(a); body.prepend(pl);
}
let last = null;
async function ask(q) {
  $('greet').hidden = true; const body = startTurn($('thread'), q);
  const all = await load(), found = search(getIndex(all), q), cands = found.confident ? found.candidates : []; last = { q, cands };
  body.replaceChildren(); const title = el('h3', null, 'answer-title'); body.append(title);
  if (!cands.length) { addPlanner(body, q); await typeInto(title, 'لا أجد أداة مناسبة لهذا الطلب في الدليل بثقة كافية. جرّب وصف المهمة بكلمات أخرى (مثل: صورة، أرشيف خبر، سجلات شركات)، أو تصفّح خريطة الأدوات.'); return; }
  if (found.jurisdictionMiss) body.append(el('p', 'تنبيه ولاية قضائية: سؤالك يذكر جهة أو دولة لا تغطيها أدوات الدليل مباشرة؛ النتائج التالية بدائل عامة أو من ولايات قضائية أخرى، فراجع نطاق تغطية كل أداة قبل الاعتماد عليها.', 'meta-line'));
  let picks = null, web = [];
  const useExt = EXTERNAL_AI && BACKEND_URL && $('ext') && $('ext').checked;
  if (useExt) {
    try { const r = await fetch(BACKEND_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'recommend', query: q, candidates: cands.map(x => ({ id: x.id, name: x.t.name, description: x.t.description })) }) }); if (r.ok) { const j = await r.json(); picks = j.picks; web = Array.isArray(j.web) ? j.web : []; } } catch { /* keyword fallback */ }
  }
  if (Array.isArray(picks) && picks.length) {
    await typeInto(title, 'هذه أنسب الأدوات في الدليل لسؤالك:');
    picks.forEach((k, i) => { const t = all[k.id]; if (t) body.append(card(t, i, [['لماذا هذه الأداة؟', k.why], ['كيف تستخدمها؟', k.how]])); });
    body.append(el('p', 'الترشيح من أدوات الدليل فقط، والروابط من قاعدة الدليل نفسها. افحص كل أداة ومصدرها قبل الاعتماد عليها.', 'meta-line fade'));
  } else {
    await typeInto(title, 'نتائج مطابقة الكلمات في دليل الأدوات (على جهازك، دون إرسال نصك)');
    body.append(el('p', (useExt ? 'تعذّر الترشيح الخارجي الآن. ' : '') + 'هذه مطابقة كلمات فقط وقد لا تناسب قضيتك: ليست ترشيح ذكاء اصطناعي ولا مُتحقَّقًا منها. للخطة المرتبة بأسباب اضغط «خطّط لقضيتي» أعلاه.', 'meta-line fade'));
    const dt = document.createElement('details'); const sm = document.createElement('summary'); sm.textContent = 'عرض ' + Math.min(cands.length, 8) + ' نتائج بحث بالكلمات (اختياري)'; dt.append(sm);
    cands.slice(0, 8).forEach((x, i) => dt.append(card(x.t, i))); body.append(dt);
  }
  addPlanner(body, q);
  const okWeb = web.filter(x => /^https:\/\//.test(x.url || '')).slice(0, 3);
  if (okWeb.length) {
    const box = el('div', null, 'web-results'); box.append(el('h4', 'نتائج بحث ويب خارجية (غير مفحوصة)', 'why'));
    okWeb.forEach(x => { const a = el('a', x.title || x.host); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; const d = el('div', null, 'web-item'); d.append(a, el('small', ' ' + x.host, 'url')); box.append(d); });
    box.append(el('p', 'هذه روابط من بحث عام على الويب وليست من قاعدة الدليل، ولم تُفحص. افتحها وتحقق منها بنفسك.', 'meta-line fade')); body.append(box);
  }
}
wireComposer({ form: $('composer'), input: $('q'), send: $('send'), chips: [...document.querySelectorAll('.chip')], onAsk: async q => { try { await ask(q); } catch (e) { startTurn($('thread'), q).replaceChildren(el('p', 'تعذّر إكمال الطلب: ' + e.message, 'why')); } } });
function showRanking(r, title, note) {
  const body = startTurn($('thread'), title);
  body.replaceChildren(el('h3', title, 'answer-title'), el('p', note, 'meta-line'));
  const seen = new Set(); const deduped = r.filter(x => x.t.url && !seen.has(x.t.url) && seen.add(x.t.url));
  const shown = deduped.slice(0, 6);
  shown.forEach((x, i) => body.append(card(x.t, i, x.scopeMismatch ? [['تنبيه نطاق:', 'أداة مقيدة بـ' + x.scopeMismatch + ' وسؤالك لا يذكر هذا النوع؛ رُتبت بعد الأدوات المطابقة لنوع مهمتك.']] : null)));
  if (shown.some(x => x.scopeMismatch)) body.append(el('p', 'التشابه الدلالي يقيس قرب الوصف لا نوع المهمة؛ الأدوات المقيدة بنطاق لا يذكره سؤالك موسومة ومؤخرة.', 'meta-line fade'));
}
const RANK_NOTE_SERVER = 'ترتيب بديل بالتشابه الدلالي (نموذج Workers AI على خادم الدليل)؛ ليس بالضرورة أدق من ترتيب الكلمات أعلاه، وهو اقتراح للمراجعة وليس إجابة موثقة. أُرسل سؤالك وأوصاف الأدوات المرشحة إلى الخادم لحساب هذا الترتيب.';
const RANK_NOTE_DEVICE = 'ترتيب بديل بالتشابه الدلالي؛ ليس بالضرورة أدق من ترتيب الكلمات أعلاه، وهو اقتراح للمراجعة وليس إجابة موثقة.';
$('local').onclick = async () => {
  if (!last) { $('status').textContent = 'اسأل أولًا ثم رتّب النتائج.'; return; }
  if (!last.cands.length) { $('status').textContent = 'لا توجد نتائج من الدليل لترتيبها دلاليًا لهذا الطلب.'; return; }
  $('local-device').hidden = true;
  $('status').textContent = 'جارٍ الترتيب الدلالي عبر خادم الدليل (Cloudflare Workers AI)...';
  try { const r = await semanticServer(last.q, last.cands); showRanking(r, 'ترتيب دلالي تجريبي عبر خادم الدليل:', RANK_NOTE_SERVER); $('status').textContent = ''; }
  catch (e) { $('status').textContent = 'تعذّر الترتيب الدلالي عبر الخادم الآن (' + e.message + ')؛ نتائج الكلمات أعلاه ما زالت متاحة. يمكنك اختيار الترتيب على جهازك صراحة بالزر المجاور (تنزيل نحو 140MB مرة واحدة).'; $('local-device').hidden = false; }
};
$('local-device').onclick = async () => {
  if (!last || !last.cands.length) return;
  $('local-device').hidden = true;
  $('status').textContent = 'جارٍ تنزيل نموذج لغوي (نحو 140MB، مرة واحدة) ليعمل على جهازك...';
  try { const r = await semantic(last.q, last.cands); showRanking(r, 'ترتيب دلالي على جهازي:', RANK_NOTE_DEVICE); $('status').textContent = ''; }
  catch (e) { $('status').textContent = 'تعذر تشغيل النموذج على هذا الجهاز: ' + e.message; }
};
// Keep the fixed composer from covering page-bottom content (consent text, semantic button) on any viewport.
const fitComposer = () => { const cw = document.querySelector('.composer-wrap'); if (cw) document.getElementById('chat').style.paddingBottom = (cw.offsetHeight + 24) + 'px'; };
addEventListener('resize', fitComposer); fitComposer();
if (EXTERNAL_AI) $('ext').addEventListener('change', e => { $('notice').textContent = e.target.checked ? NOTICE : ''; });
else if ($('ext')) $('ext').closest('label').hidden = true; // static-only build: external mode unavailable, not just off

const initQ = new URLSearchParams(location.search).get('q');
if (initQ && initQ.trim()) { const q = initQ.trim().slice(0, 300); $('q').value = q; ask(q).catch(e => startTurn($('thread'), q).replaceChildren(el('p', 'تعذّر إكمال الطلب: ' + e.message, 'why'))); }
