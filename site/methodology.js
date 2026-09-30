const KEY = 'osint-methodology-progress-v1';
const checks = Array.from(document.querySelectorAll('.stagecheck'));
const bar = document.getElementById('progbar');
const txt = document.getElementById('progtext');
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || []; } catch { state = []; }
function paint() {
  const done = checks.filter(c => c.checked).length;
  bar.style.width = (done / checks.length * 100) + '%';
  txt.textContent = done === 0 ? 'لم تبدأ بعد — افتح المرحلة الأولى وابدأ.'
    : done === checks.length ? 'أنجزت المنهجية كاملة. راجع أدلتك قبل النشر.'
    : 'أنجزت ' + done + ' من ' + checks.length + ' مراحل.';
}
checks.forEach((c, i) => {
  c.checked = !!state[i];
  c.addEventListener('change', () => {
    state[i] = c.checked;
    localStorage.setItem(KEY, JSON.stringify(state));
    paint();
  });
});
document.getElementById('resetprog').addEventListener('click', () => {
  state = [];
  localStorage.removeItem(KEY);
  checks.forEach(c => c.checked = false);
  paint();
});
paint();
