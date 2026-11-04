/* مهام أوش: لوحات كانبان محلية بقوائم وبطاقات وسحب وإفلات. */
import { getFile, putFile, newFile, esc, download, toast, debounce, fileParam, uid } from './kernel.js';

const $ = s => document.querySelector(s);
const board = $('#board');
let file = null, dirty = false, dragCard = null, editing = null, filter = '';

const save = debounce(async () => { await putFile(file); dirty = false; $('#save-status').textContent = 'محفوظ محليًا ' + new Date().toLocaleTimeString('ar-EG-u-nu-latn'); }, 500);
function markDirty() { dirty = true; $('#save-status').textContent = 'يحفظ…'; save(); renderStats(); }

function renderStats() {
  const all = file.data.lists.flatMap(l => l.cards);
  const done = file.data.lists[file.data.lists.length - 1];
  const late = all.filter(c => c.due && new Date(c.due) < new Date(new Date().toDateString())).length;
  $('#board-stats').textContent = `${all.length} بطاقة${late ? ` · ${late} متأخرة` : ''}`;
}
function cardMatch(c) { if (!filter) return true; return (c.title + ' ' + (c.desc || '') + ' ' + (c.labels || []).join(' ')).includes(filter); }
function render() {
  board.innerHTML = '';
  for (const list of file.data.lists) {
    const col = document.createElement('div'); col.className = 'osh-list'; col.dataset.list = list.id;
    const cards = list.cards.filter(cardMatch);
    col.innerHTML = `<header><strong>${esc(list.title)}</strong><span class="count">${list.cards.length}</span><button class="osh-tbtn" data-ren title="إعادة تسمية">✎</button><button class="osh-tbtn" data-dellist title="حذف القائمة">🗑</button></header><div class="osh-cards"></div><button class="osh-add-card">+ بطاقة</button>`;
    const host = col.querySelector('.osh-cards');
    for (const c of cards) {
      const d = document.createElement('div'); d.className = 'osh-card'; d.draggable = true; d.dataset.card = c.id;
      const late = c.due && new Date(c.due) < new Date(new Date().toDateString());
      const ckTotal = (c.check || []).length, ckDone = (c.check || []).filter(x => x.done).length;
      d.innerHTML = `<strong>${esc(c.title)}</strong>${c.desc ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(c.desc.slice(0, 90))}</div>` : ''}<div class="meta">${c.due ? `<span class="due${late ? ' late' : ''}">${esc(c.due)}</span>` : ''}${(c.labels || []).map(l => `<span class="lab">${esc(l)}</span>`).join('')}${c.pr ? `<span class="pr ${c.pr}">${{ high: 'عالية', mid: 'متوسطة', low: 'منخفضة' }[c.pr]}</span>` : ''}${ckTotal ? `<span class="ck">☑ ${ckDone}/${ckTotal}</span>` : ''}</div>`;
      d.addEventListener('click', () => openCard(list, c));
      d.addEventListener('dragstart', e => { dragCard = { from: list.id, id: c.id }; d.classList.add('drag'); });
      d.addEventListener('dragend', () => d.classList.remove('drag'));
      host.appendChild(d);
    }
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('dragover');
      if (!dragCard) return;
      const from = file.data.lists.find(l => l.id === dragCard.from);
      const idx = from.cards.findIndex(x => x.id === dragCard.id);
      if (idx < 0) return;
      const [card] = from.cards.splice(idx, 1);
      list.cards.push(card);
      dragCard = null; markDirty(); render();
    });
    col.querySelector('.osh-add-card').addEventListener('click', () => openCard(list, null));
    col.querySelector('[data-ren]').addEventListener('click', () => { const n = prompt('اسم القائمة:', list.title); if (n && n.trim()) { list.title = n.trim(); markDirty(); render(); } });
    col.querySelector('[data-dellist]').addEventListener('click', () => { if (confirm(`احذف قائمة «${list.title}» وبطاقاتها؟`)) { file.data.lists = file.data.lists.filter(l => l.id !== list.id); markDirty(); render(); } });
    board.appendChild(col);
  }
  renderStats();
}
/* محرر البطاقة */
function openCard(list, card) {
  editing = { list, card };
  $('#c-title').value = card ? card.title : '';
  $('#c-desc').value = card ? (card.desc || '') : '';
  $('#c-due').value = card ? (card.due || '') : '';
  $('#c-pr').value = card ? (card.pr || '') : '';
  $('#c-labels').value = card ? (card.labels || []).join('، ') : '';
  $('#c-check').value = card ? (card.check || []).map(x => (x.done ? '[x] ' : '') + x.text).join('\n') : '';
  $('#c-delete').style.display = card ? '' : 'none';
  $('#card-modal').classList.add('open');
  $('#c-title').focus();
}
$('#c-save').addEventListener('click', () => {
  const { list, card } = editing;
  const title = $('#c-title').value.trim();
  if (!title) return toast('العنوان مطلوب');
  const data = {
    title,
    desc: $('#c-desc').value.trim(),
    due: $('#c-due').value,
    pr: $('#c-pr').value,
    labels: $('#c-labels').value.split(/[،,]/).map(x => x.trim()).filter(Boolean),
    check: $('#c-check').value.split('\n').map(x => x.trim()).filter(Boolean).map(x => ({ done: x.startsWith('[x]'), text: x.replace(/^\[x\]\s*/, '') }))
  };
  if (card) Object.assign(card, data); else list.cards.push({ id: uid(), ...data });
  $('#card-modal').classList.remove('open'); markDirty(); render();
});
$('#c-delete').addEventListener('click', () => {
  const { list, card } = editing;
  list.cards = list.cards.filter(x => x.id !== card.id);
  $('#card-modal').classList.remove('open'); markDirty(); render();
});
$('#c-cancel').addEventListener('click', () => $('#card-modal').classList.remove('open'));
$('#task-search').addEventListener('input', e => { filter = e.target.value.trim(); render(); });
$('#btn-add-list').addEventListener('click', () => { const n = prompt('اسم القائمة الجديدة:'); if (n && n.trim()) { file.data.lists.push({ id: uid(), title: n.trim(), cards: [] }); markDirty(); render(); } });

/* تصدير/استيراد */
$('#btn-export-md').addEventListener('click', () => {
  let md = `# ${file.name}\n\n`;
  for (const l of file.data.lists) { md += `## ${l.title}\n`; for (const c of l.cards) { md += `- [${c.due ? ' ' : ' '}] **${c.title}**${c.due ? ' — ' + c.due : ''}${c.desc ? '  \n  ' + c.desc.replace(/\n/g, ' ') : ''}\n`; for (const ck of c.check || []) md += `  - [${ck.done ? 'x' : ' '}] ${ck.text}\n`; } md += '\n'; }
  download(file.name + '.md', new Blob([md], { type: 'text/markdown;charset=utf-8' }));
});
function wireFileMenu() {
  const btn = $('#btn-file'), menu = $('#menu-file');
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
  menu.addEventListener('click', async e => {
    const act = e.target.dataset.act; if (!act) return; menu.classList.remove('open');
    if (act === 'new') { const f = newFile('board'); await putFile(f); location.href = './tasks.html?f=' + f.id; }
    if (act === 'export-json') download(file.name + '.oshboard.json', new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
    if (act === 'import-json') { const inp = $('#file-input'); inp.accept = '.json'; inp.onchange = async () => { try { const j = JSON.parse(await inp.files[0].text()); if (j.kind === 'board' && j.data && Array.isArray(j.data.lists)) { file.data = j.data; markDirty(); render(); toast('استُوردت اللوحة'); } else toast('الملف ليس لوحة مهام صالحة'); } catch { toast('تعذّر قراءة الملف'); } inp.value = ''; }; inp.click(); }
    if (act === 'hub') location.href = './index.html';
  });
}
$('#doc-name').addEventListener('change', async e => { file.name = e.target.value.trim() || file.name; await putFile(file); });
async function load() {
  const id = fileParam();
  if (id) file = await getFile(id);
  if (!file) { file = newFile('board'); await putFile(file); history.replaceState(null, '', './tasks.html?f=' + file.id); }
  $('#doc-name').value = file.name;
  const params = new URLSearchParams(location.search);
  if (params.get('import') === '1') {
    const dataUrl = sessionStorage.getItem('osh-import-' + file.id);
    if (dataUrl) { sessionStorage.removeItem('osh-import-' + file.id); try { const j = JSON.parse(await (await (await fetch(dataUrl)).blob()).text()); if (j.kind === 'board' && j.data) file.data = j.data; } catch {} }
  }
  wireFileMenu(); render();
}
addEventListener('beforeunload', () => { if (dirty) putFile(file); });
load();
