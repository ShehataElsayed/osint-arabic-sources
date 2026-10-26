import { buildIndex, search, normalize, stem } from './tool-search.js';

const $ = id => document.getElementById(id);
const B = window.BRANCHES || [];
const stage = $('stage'), svg = $('lines'), input = $('q'), out = $('out'), trace = $('trace'), reply = $('reply'), hint = $('hint');
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

let tools = null, idx = null, lit = [];
const ready = fetch('./search-tools.json').then(r => { if (!r.ok) throw new Error('index'); return r.json(); }).then(t => { tools = t; idx = buildIndex(t); return idx; });

/* ---------- connected map lines ---------- */
function ctr(e) { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, r]; }
function path(cls, d) { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); p.setAttribute('d', d); svg.append(p); return p; }
function dot(x, y) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 3.5); svg.append(c); }
function draw() {
  svg.replaceChildren();
  const hubs = [...document.querySelectorAll('.hub')];
  document.querySelectorAll('.cluster').forEach(c => {
    const [hx, hy, hr] = ctr(c.querySelector('.hub'));
    c.querySelectorAll('.node').forEach(n => {
      const [nx, ny, nr] = ctr(n);
      if (nr.top > hr.bottom - 4) { const my = (hy + ny) / 2; path('w', `M${hx} ${hr.bottom - 10}C${hx} ${my},${nx} ${my},${nx} ${nr.top + 10}`); }
      else { const mx = (hx + nx) / 2; path('w', `M${hr.left + 10} ${hy}C${mx} ${hy},${mx} ${ny},${nr.right - 10} ${ny}`); }
    });
  });
  for (let i = 0; i < hubs.length - 1; i++) {
    const [ax, , ar] = ctr(hubs[i]), [bx, , br] = ctr(hubs[i + 1]);
    path('hh', `M${ax} ${ar.bottom}C${ax} ${(ar.bottom + br.top) / 2},${bx} ${(ar.bottom + br.top) / 2},${bx} ${br.top}`);
  }
  if (lit.length) {
    const src = out.hidden ? document.querySelector('.console') : out;
    const sr = src.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const ox = sr.left - s.left + sr.width / 2, oy = sr.bottom - s.top;
    lit.forEach(n => {
      const [nx, , nr] = ctr(n), ty = nr.top - s.top + 2, my = (oy + ty) / 2;
      const p = path('q', `M${ox} ${oy}C${ox} ${my},${nx} ${my},${nx} ${ty}`);
      try { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset .7s ease'; requestAnimationFrame(() => p.style.strokeDashoffset = 0); } catch (e) { }
      dot(nx, ty);
    });
  }
}
let raf = 0; const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
addEventListener('resize', redraw);
if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(stage);
document.fonts && document.fonts.ready.then(redraw);
addEventListener('load', redraw);

/* ---------- search ---------- */
const EXPLAIN = 'ترتيب محلي بالكلمات داخل متصفحك. لا يرسل سؤالك إلى أي خادم، ولا يتضمن هذا الرد شرحًا بالذكاء الاصطناعي.';
function setLit(counts) {
  document.querySelectorAll('.node').forEach(n => { n.classList.remove('lit', 'dim'); const b = n.querySelector('.hit-badge'); b.hidden = true; });
  lit = [];
  const has = Object.keys(counts).length;
  document.querySelectorAll('.node').forEach(n => {
    const c = counts[n.dataset.b];
    if (c) { n.classList.add('lit'); const b = n.querySelector('.hit-badge'); b.hidden = false; b.textContent = c + (c === 1 ? ' أداة' : ' أدوات'); lit.push(n); }
    else if (has) n.classList.add('dim');
  });
}
function step(html, bad) { const li = el('li', bad ? 'bad' : ''); li.append(...html); return li; }
function b(t) { return el('b', '', t); }
function termsBox(base, exp) {
  const d = el('div', 'terms');
  base.forEach(t => d.append(el('span', '', t)));
  if (exp.length) d.append(el('span', 'x', '+' + exp.length + ' مرادفات'));
  return d;
}
function card(r, top, terms) {
  const t = r.t, a = el('article', 'res'); a.append(el('span', 'bar'));
  const h = el('h3', '', t.name); h.dir = 'auto'; a.append(h);
  const p = el('p', '', t.description); p.dir = 'auto'; a.append(p);
  const row = el('div', 'row');
  const br = t.b !== undefined && B[t.b];
  if (br) { const l = el('a', '', 'الفرع: ' + br.t + (t.s ? ' › ' + t.s : '')); l.href = 'branches/' + br.s + '.html'; row.append(l); }
  const toks = new Set(normalize(t.name + ' ' + t.description).split(' ').map(stem));
  const hit = terms.filter(x => toks.has(x.s)).map(x => x.w).slice(0, 4);
  if (hit.length) row.append(el('span', 'why', 'تطابق: ' + hit.join('، ')));
  const g = el('a', '', 'افتح الأداة ↗'); g.href = t.url; g.target = '_blank'; g.rel = 'noopener noreferrer'; g.dataset.osintTool = t.name; row.append(g);
  a.append(row);
  const sc = el('span', 'score'); sc.title = 'قوة التطابق النسبية داخل هذه النتائج'; const i = document.createElement('i'); i.style.width = Math.max(8, Math.round(100 * r.score / top)) + '%'; sc.append(i); a.append(sc);
  return a;
}
function analyse(q, limit = 300) {
  const found = search(idx, q, { limit });
  const words = [...new Set(normalize(q).split(' ').filter(Boolean))];
  const baseStems = new Map(words.map(w => [stem(w), w]));
  const base = [], exp = [];
  found.terms.forEach(tm => (baseStems.has(tm) ? base : exp).push(tm));
  const termObjs = [...base.map(s => ({ s, w: baseStems.get(s) })), ...exp.map(s => ({ s, w: s }))];
  return { found, base: base.map(s => baseStems.get(s)), exp, termObjs };
}
function render(q) {
  const a = analyse(q), f = a.found, cands = f.candidates;
  out.hidden = false;
  trace.replaceChildren(); reply.replaceChildren();
  trace.append(el('h2', '', 'مسار البحث'));
  const s1 = step([b('1. قراءة السؤال'), document.createTextNode(a.base.length ? ` ${a.base.length} كلمات مفهومة، و${a.exp.length} مرادفات من مفردات مهام الدليل.` : ' لم تُستخرج كلمات يعرفها الدليل.'), termsBox(a.base, a.exp)], !a.base.length);
  const s2 = step([b('2. فحص الفهرس'), document.createTextNode(` ${tools.length} أداة موصوفة بالعربية؛ ${cands.length} منها تطابق كلمة على الأقل.`)], !cands.length);
  const confident = f.confident;
  const reasonBad = !f.known ? 'لا تحوي صياغتك مفردات يعرفها الدليل لمهام الصحفيين.' : 'أعلى تطابق ضعيف.';
  const s3 = step([b('3. الحكم على الثقة'), document.createTextNode(confident ? ` كافية: أعلى درجة ${cands[0].score.toFixed(1)}.` : ' غير كافية. ' + reasonBad)], !confident);
  trace.append(s1, s2, s3);
  const shown = confident ? cands.slice(0, 5).filter(r => r.score >= cands[0].score * 0.3) : [];
  const counts = {};
  if (confident) cands.slice(0, 15).forEach(r => { if (r.t.b !== undefined) counts[r.t.b] = (counts[r.t.b] || 0) + 1; });
  const nb = Object.keys(counts).length;
  trace.append(step([b('4. الفروع'), document.createTextNode(confident ? ` الأدوات الأقرب موزعة على ${nb} ${nb === 1 ? 'فرع' : 'فروع'}، أضأناها في الخريطة.` : ' لا فروع مرشحة.')], !confident));
  reply.append(el('h2', '', 'الرد'));
  if (confident) {
    reply.append(el('p', 'lead2', `أقرب ${shown.length} ${shown.length === 1 ? 'أداة' : 'أدوات'} في الدليل لمهمتك:`));
    const box = el('div', 'results'); shown.forEach(r => box.append(card(r, cands[0].score, a.termObjs))); reply.append(box);
    if (cands.length > shown.length) reply.append(el('p', 'fine', `و${cands.length - shown.length} نتائج أضعف تطابقًا لم تُعرض هنا.`));
    const nav = el('p', 'fine'); const l = el('a', '', 'انظر الفروع المضيئة في الخريطة ↓'); l.href = '#branches'; nav.append(l); reply.append(nav);
  } else {
    reply.append(el('p', 'lead2', 'لا أجد أداة مناسبة لهذا الطلب بثقة كافية.'));
    reply.append(el('p', 'stateline', 'جرّب وصف المهمة بكلمات أخرى: نطاق، صورة، سفينة، شركة، حساب، رقم هاتف، تسريب، أرشيف. أو تصفّح الفروع أدناه.'));
    if (cands.length) {
      const d = el('details', 'weak'); d.append(el('summary', '', `أقرب ${Math.min(3, cands.length)} نتائج ضعيفة (غير موصى بها)`));
      const box = el('div', 'results'); cands.slice(0, 3).forEach(r => box.append(card(r, cands[0].score, a.termObjs))); d.append(box); reply.append(d);
    }
  }
  reply.append(el('p', 'fine', EXPLAIN));
  setLit(counts); redraw();
}
function idle() { out.hidden = true; setLit({}); redraw(); }
let timer = 0;
input.addEventListener('input', () => {
  clearTimeout(timer);
  const q = input.value.trim();
  if (!q) { idle(); return; }
  timer = setTimeout(async () => {
    if (q.length < 2) return;
    try { await ready; if (input.value.trim() === q) render(q); }
    catch (e) { out.hidden = false; trace.replaceChildren(); reply.replaceChildren(el('p', 'lead2', 'تعذّر تحميل فهرس البحث. أعد تحميل الصفحة، أو تصفّح الفروع مباشرة.')); }
  }, 180);
});
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } if (e.key === 'Escape' && document.activeElement === input && input.value) { input.value = ''; idle(); } });

/* ---------- example chips and real examples ---------- */
function ask(q) { input.value = q; input.dispatchEvent(new Event('input')); scrollTo({ top: 0 }); input.focus({ preventScroll: true }); }
const chips = $('chips');
(window.EXAMPLES || []).forEach(q => { const c = el('button', 'chip', q); c.type = 'button'; c.onclick = () => ask(q); chips.append(c); });
ready.then(() => {
  const g = $('exgrid'); g.replaceChildren();
  (window.EXAMPLES || []).forEach(q => {
    const a = analyse(q, 6), cands = a.found.candidates, card_ = el('article', 'ex');
    card_.append(el('q', '', q));
    if (a.found.confident) {
      const ol = el('ol'); cands.slice(0, 3).forEach(r => { const li = el('li'); const n = el('span', '', r.t.name); n.dir = 'auto'; li.append(n); const br = r.t.b !== undefined && B[r.t.b]; if (br) li.append(el('small', '', br.t)); ol.append(li); }); card_.append(ol);
    } else card_.append(el('p', 'stateline', 'امتنع المحرك عن الترشيح لضعف الأدلة في هذه الصياغة.'));
    const bt = el('button', 'btn ghost', 'شغّلها في الشريط'); bt.type = 'button'; bt.onclick = () => ask(q); card_.append(bt);
    g.append(card_);
  });
}).catch(() => { $('exgrid').replaceChildren(el('p', 'muted', 'تعذّر تحميل فهرس الأمثلة.')); });
redraw();
