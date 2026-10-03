// Shared chat helpers for the guide's chat-style sections.
export const $ = id => document.getElementById(id);
export const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const NOTICE = 'يُرسل نص طلبك إلى خدمة ذكاء اصطناعي خارجية قد تستخدمه لتحسين منتجاتها، فلا تكتب بيانات حساسة.';
export async function typeInto(node, text) { if (REDUCED) { node.textContent = text; return; } const w = text.split(' '); node.textContent = ''; for (let i = 0; i < w.length; i++) { node.textContent += (i ? ' ' : '') + w[i]; await sleep(28); } }
export function startTurn(thread, q) {
  const turn = el('div', null, 'turn'), bot = el('div', null, 'bot'), body = el('div', null, 'bot-body'), dots = el('div', null, 'thinking');
  dots.append(el('i'), el('i'), el('i')); body.append(dots); bot.append(el('div', null, 'spark'), body); turn.append(el('div', q, 'user-msg'), bot); thread.append(turn);
  turn.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  return body;
}
export function wireComposer({ form, input, send, chips, onAsk }) {
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
  let busy = false;
  const go = async text => { text = text.trim(); if (!text || busy) return; busy = true; send.disabled = true; input.value = ''; autosize(); try { await onAsk(text); } finally { busy = false; send.disabled = false; } };
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(input.value); } });
  form.onsubmit = e => { e.preventDefault(); go(input.value); };
  chips.forEach(c => c.onclick = () => go(c.textContent));
}
