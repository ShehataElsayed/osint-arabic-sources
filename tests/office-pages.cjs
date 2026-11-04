/* Osh Office suite browser contract: hub creates files; writer edits and saves; sheets compute;
   slides render; tasks board works. Offline-safe: AI calls are stubbed to fail fast. */
const { chromium } = require('playwright'), { spawn } = require('child_process'), assert = require('assert/strict'), fs = require('fs');
(async () => {
  fs.mkdirSync('test-output', { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', '8793', '--bind', '127.0.0.1', '--directory', process.env.TEST_SITE || '_site'], { stdio: 'ignore' });
  let b;
  try {
    await new Promise(r => setTimeout(r, 500));
    b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    const p = await b.newPage({ viewport: { width: 1380, height: 940 } });
    await p.route('**/osint-rag.egkrkr.workers.dev/**', r => r.fulfill({ status: 503, body: '{}' }));
    const base = 'http://127.0.0.1:8793/office/';
    /* hub */
    await p.goto(base + 'index.html');
    await p.locator('.osh-new-card[data-new=doc]').waitFor();
    assert.equal(await p.locator('.osh-new-card').count(), 4, 'four app cards');
    await p.screenshot({ path: 'test-output/office-hub.png' });
    for(const width of [320,390,1380]) {
      await p.setViewportSize({width,height:940});
      assert(await p.locator('.brand small').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth}), 'header subtitle is not clipped');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    /* writer: create from hub, type, save, reload keeps text */
    await p.locator('.osh-new-card[data-new=doc]').click();
    await p.waitForURL(/writer\.html\?f=/);
    await p.locator('#page').click();
    await p.keyboard.type('تقرير تجريبي عن التحقق');
    await p.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('محفوظ'), null, { timeout: 6000 });
    const docUrl = p.url();
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#page')?.innerText.includes('تقرير تجريبي'));
    await p.locator('#btn-ai').click();
    await p.locator('.osh-ai-action[data-ai=summarize]').click();
    await p.waitForFunction(() => { const t = document.querySelector('#ai-result')?.textContent || ''; return t.length > 10 && !t.includes('جارٍ'); }, null, { timeout: 8000 });
    await p.screenshot({ path: 'test-output/office-writer.png' });
    /* docx export downloads */
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), (async () => { await p.locator('#btn-file').click(); await p.locator('[data-act=export-docx]').click(); })()]);
    await dl.saveAs('test-output/export.docx');
    assert.ok(fs.readFileSync('test-output/export.docx').subarray(0, 2).toString() === 'PK', 'docx is a zip package');
    /* sheets: new file, enter values + formula */
    await p.goto(base + 'index.html');
    await p.locator('.osh-new-card[data-new=sheet]').click();
    await p.waitForURL(/sheets\.html\?f=/);
    await p.locator('#formula-input').fill('5'); await p.keyboard.press('Enter');
    await p.locator('#formula-input').fill('7'); await p.keyboard.press('Enter');
    await p.locator('#formula-input').fill('=A1+A2'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('#cellref')?.textContent === 'A4');
    const val = await p.evaluate(() => { const c = document.querySelector('#grid'); return c ? true : false; });
    assert.ok(val);
    const sheetUrl = p.url();
    /* persisted */
    await p.reload(); await p.locator('#grid').waitFor();
    const kept = await p.evaluate(() => window.__oshSheet.displayValue(3, 1));
    assert.equal(kept, 12, 'sheet persisted and recomputed =A1+A2 as 12 after reload');
    /* slides */
    await p.goto(base + 'index.html');
    await p.locator('.osh-new-card[data-new=deck]').click();
    await p.waitForURL(/slides\.html\?f=/);
    await p.locator('#t-add-slide').click();
    await p.locator('#t-text').click();
    await p.waitForFunction(() => document.querySelectorAll('#thumbs .osh-thumb').length === 2);
    await p.screenshot({ path: 'test-output/office-slides.png' });
    const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), (async () => { await p.locator('#btn-file').click(); await p.locator('[data-act=export-pptx]').click(); })()]);
    await dl2.saveAs('test-output/export.pptx');
    assert.ok(fs.readFileSync('test-output/export.pptx').subarray(0, 2).toString() === 'PK', 'pptx is a zip package');
    /* tasks */
    await p.goto(base + 'index.html');
    await p.locator('.osh-new-card[data-new=board]').click();
    await p.waitForURL(/tasks\.html\?f=/);
    await p.locator('.osh-add-card').first().click();
    await p.locator('#c-title').fill('بطاقة اختبار');
    await p.locator('#c-save').click();
    await p.waitForFunction(() => document.querySelector('.osh-card strong')?.textContent === 'بطاقة اختبار');
    /* hub lists the four files */
    await p.goto(base + 'index.html');
    await p.waitForFunction(() => document.querySelectorAll('.osh-file-card').length >= 4);
    await p.screenshot({ path: 'test-output/office-hub-files.png' });
    console.log(JSON.stringify({ pass: true, docUrl: !!docUrl, sheetUrl: !!sheetUrl }));
  } finally { if (b) await b.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
