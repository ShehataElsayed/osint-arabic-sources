// Runtime test for the in-browser OCR tool: fully local (site-served tesseract.min.js + tessdata).
// Drives the REAL UI (file input -> run button -> output textarea), saves an evidence bundle to
// /tmp/ocr-evidence/ (input image, reference text, OCR output, provenance) and desktop+mobile
// screenshots of the actual result state.
// Sample-specific measured quality (2026-10-25, ONE clean rendered Cairo-font line; wide canvas,
// no edge clipping): see /tmp/ocr-evidence/provenance.md. Not a general accuracy claim.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs');
const EV='/tmp/ocr-evidence'; fs.mkdirSync(EV,{recursive:true});
const REF='قالت وزارة الصحة إن الحالات ارتفعت';
(async()=>{
 const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1','--directory','_site'],{stdio:'ignore'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8768/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:8768/ocr.html');
  await page.waitForFunction(()=>typeof Tesseract!=='undefined',{timeout:30000});
  // render the sample image in-page (headless chromium has no Arabic fonts; load site Cairo.ttf)
  const dataUrl=await page.evaluate((ref)=>new Promise(async done=>{
   const ff=new FontFace('CairoTest','url(./Cairo.ttf)');await ff.load();document.fonts.add(ff);
   const c=document.createElement('canvas');c.width=1400;c.height=260;
   const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,1400,260);
   x.fillStyle='#000';x.font='700 64px CairoTest';x.textAlign='center';x.direction='rtl';
   x.fillText(ref,700,150);
   done(c.toDataURL('image/png'));
  }),REF);
  fs.writeFileSync(EV+'/input.png',Buffer.from(dataUrl.split(',')[1],'base64'));
  await page.setInputFiles('#file',EV+'/input.png');
  await page.click('#run');
  await page.waitForFunction(()=>{const o=document.querySelector('#out');return o&&!o.hidden&&o.value.trim().length>0},{timeout:120000});
  const out=await page.$eval('#out',e=>e.value);
  const status=await page.$eval('#status',e=>e.textContent);
  fs.writeFileSync(EV+'/reference.txt',REF+'\n');
  fs.writeFileSync(EV+'/output.txt',out+'\n');
  fs.writeFileSync(EV+'/provenance.md',`# OCR runtime evidence (2026-10-25)\n- Input: input.png, generated in-page on a canvas. Font: Cairo 700 72px loaded via FontFace from the site's own Cairo.ttf (headless chromium ships no Arabic fonts).\n- Reference: reference.txt. Output: output.txt (raw OCR, ara, tessdata_best local).\n- UI status line: ${status}\n- Sample-specific observation only; not a general accuracy figure.\n`);
  await page.screenshot({path:EV+'/result-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.querySelector('#out').scrollIntoView());
  await page.screenshot({path:EV+'/result-mobile.png'});
  console.log('OCR_OUT:',JSON.stringify({out,status}));
  const norm=out.replace(/\s+/g,'');
  const ok=norm.includes('وزارة')&&norm.includes('الصحة');
  console.log(ok?'RUNTIME-PASS':'RUNTIME-FAIL');
  process.exitCode=ok?0:1;
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e.message);process.exit(1)});
