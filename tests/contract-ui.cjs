// Frontend<->worker contract test (OFFLINE): real worker output (mode 'ask', the path the UI calls)
// is generated against scripted fixtures, then rendered by the REAL assistant page. Asserts the UI
// states match each worker outcome. No live API calls anywhere.
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const OK_URL = 'https://www.who.int/ar/news/item/01-01-2026-report';
const PAGE = `<html><head><title>تقرير</title><meta property="og:site_name" content="WMO"></head><body>
<p>ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير بشكل قياسي حسب التقرير السنوي للمنظمة</p>
<p>تؤثر موجات الحر البحرية على الثروة السمكية والنظم البيئية البحرية في العالم</p>
<p>هذه جملة ثالثة طويلة بما يكفي لتصبح مرشحة للاقتباس الحرفي في الفحص الآلي للمصادر</p>
</body></html>`;
const CANDS = [{ id: 0, name: 'بيانات المناخ', description: 'قواعد بيانات مفتوحة عن حرارة البحر للصحفيين' }];

function scripted(draft, pages = { [OK_URL]: PAGE }) {
  return async (url, o = {}) => {
    const u = String(url);
    if (u.includes('openrouter.ai') || u.includes('generativelanguage.googleapis.com')) {
      const body = JSON.parse(o.body);
      const prompt = body.messages ? body.messages[0].content : body.contents[0].parts[0].text;
      const wrap = t => u.includes('openrouter.ai')
        ? { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: t } }] }) }
        : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) };
      if (prompt.includes('أجب عن السؤال التالي')) return wrap(draft);
      if (prompt.includes('أعد كتابة الإجابة')) return wrap('{}');
      if (prompt.includes('أنت مدقق ناقد')) return wrap('{"contradiction":0.1}');
      return wrap('{}');
    }
    if (u.includes('batchEmbedContents')) return { ok: false, status: 429, json: async () => ({}) };
    if (u.includes('rdap.org')) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes('wikipedia.org') || u.includes('gdeltproject.org') || u.includes('api.exa.ai')) return { ok: false, status: 429, json: async () => ({}) };
    if (u.includes('factchecktools')) return { ok: false, status: 404, json: async () => ({}) };
    for (const [pfx, body] of Object.entries(pages)) if (u.startsWith(pfx)) return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => body };
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

(async () => {
  const { askAssistant } = await import('../worker/rag-lib.js');
  const ENV = { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' };
  const draftSupported = JSON.stringify({
    answer: 'تؤثر موجات الحر البحرية على الثروة السمكية [S1]. ارتفعت درجات الحرارة قياسيًا [S1].',
    claims: ['تؤثر موجات الحر البحرية على الثروة السمكية', 'ارتفعت درجات حرارة البحر في المنطقة خلال العقد الأخير'],
    numbers: [], time_sensitive: false, sources: [{ name: 'تقرير المنظمة', url: OK_URL }],
  });
  const draftUnsupported = JSON.stringify({
    answer: 'ادعاءات ملفقة [S1].', claims: ['انخفض الصيد في خليج السويس بنسبة 60 بالمئة', 'ارتفع عدد السفن الغارقة إلى 45 سفينة'],
    numbers: [], time_sensitive: false, sources: [{ name: 'تقرير المنظمة', url: OK_URL }],
  });
  const draftNoClaims = JSON.stringify({ answer: 'خلاصة عامة بلا ادعاءات قابلة للفحص.', claims: [], numbers: [], time_sensitive: false, sources: [{ name: 'تقرير المنظمة', url: OK_URL }] });

  const scenarios = {
    answer: await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, { ...ENV }, scripted(draftSupported)),
    unsupported: await askAssistant('ما أثر موجات الحر البحرية؟', CANDS, { ...ENV }, scripted(draftUnsupported)),
    noclaims: await askAssistant('سؤال عام كاف للفحص', CANDS, { ...ENV }, scripted(draftNoClaims)),
    busy: await askAssistant('سؤال', CANDS, { ...ENV }, async (url, o = {}) => {
      const u = String(url);
      if (u.includes('openrouter.ai')) return { ok: false, status: 429, json: async () => ({}) };
      return scripted(draftSupported)(url, o);
    }),
  };
  if (scenarios.answer.error) throw new Error('answer scenario errored: ' + scenarios.answer.error);
  console.log('worker decisions:', Object.entries(scenarios).map(([k, v]) => `${k}=${v.error || v.decision + (v.insufficient_reason ? '/' + v.insufficient_reason : '')}`).join(' '));

  const server = spawn('python3', ['-m', 'http.server', '8775', '--bind', '127.0.0.1', '--directory', '_site'], { stdio: 'ignore' });
  let browser;
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:8775/')).ok) break } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    for (const [name, fx] of Object.entries(scenarios)) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('**/osint-rag.egkrkr.workers.dev/**', r => r.fulfill({ status: fx.error ? 200 : 200, contentType: 'application/json', body: JSON.stringify(fx) }));
      await page.goto('http://127.0.0.1:8775/assistant.html');
      await page.getByLabel('سؤالك', { exact: true }).fill('سؤال اختبار التكامل؟');
      await page.getByRole('button', { name: 'اسأل الآن', exact: true }).click();
      await page.waitForTimeout(700);
      const body = await page.locator('#askResult').innerText().catch(() => '');
      const modeNote = await page.locator('#mode').innerText().catch(() => '');
      if (name === 'answer') {
        ok(scenarios.answer.decision !== 'insufficient' ? body.includes('موجات الحر البحرية') : true, 'answer: answer text rendered');
        ok(body.includes('نتائج الفحوص الآلية'), 'answer: checks card rendered');
        ok(body.includes('معايير معلنة'), 'answer: criteria framing present');
        ok(!/MODEL_CALL_BUDGET|ef-run|budget_skip/.test(body), 'answer: no internal codes leaked');
        if (scenarios.answer.decision !== 'insufficient') {
          const claims = await page.locator('#askResult .claim').count();
          ok(claims >= 1, 'answer: claims support rows rendered');
        }
      }
      if (name === 'unsupported') {
        ok(scenarios.unsupported.decision === 'insufficient' && scenarios.unsupported.insufficient_reason === 'unsupported_claims', 'unsupported: worker labeled evidence-driven');
        ok(body.includes('أدلة غير كافية'), 'unsupported: evidence badge shown');
        ok(body.includes('فُتحت مصادر'), 'unsupported: explains sources opened but unsupported');
        ok(!body.includes('تعذّرت المعالجة'), 'unsupported: not mislabeled as processing failure');
      }
      if (name === 'noclaims') {
        ok(scenarios.noclaims.decision === 'insufficient' && scenarios.noclaims.insufficient_reason === 'no_checkable_claims', 'noclaims: worker labeled processing limitation');
        ok(body.includes('تعذّرت المعالجة'), 'noclaims: processing badge shown');
        ok(body.includes('استخراج ادعاءات'), 'noclaims: explains extraction failure');
        ok(!body.includes('أدلة غير كافية'), 'noclaims: not mislabeled as evidence gap');
      }
      if (name === 'busy') {
        ok(scenarios.busy.error === 'busy', 'busy: worker returned busy');
        ok((body + modeNote).includes('ضغط على الخدمة'), 'busy: UI shows pressure message');
        ok(!body.includes('أدلة غير كافية'), 'busy: never shown as evidence gap');
      }
      await page.close();
    }
  } finally { if (browser) await browser.close(); server.kill(); }
  if (fails.length) { console.error('CONTRACT FAILURES:\n- ' + fails.join('\n- ')); process.exit(1); }
  console.log('PASS: frontend<->worker contract (mode ask) — answer/unsupported/noclaims/busy rendered per worker labels. Offline fixtures, no live calls.');
})().catch(e => { console.error(e); process.exit(1); });
