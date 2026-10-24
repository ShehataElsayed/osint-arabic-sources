const {chromium}=require('playwright');
const {spawn}=require('child_process');
(async()=>{
 const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1','--directory','/tmp/osint/_site'],{stdio:'ignore'});
 let browser;
 try {
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8768/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:8768/assistant.html?local=1');
  await page.getByLabel('عنوان المصدر',{exact:true}).fill('تقرير المناخ السنوي');
  await page.getByLabel('نص المصدر',{exact:true}).fill('ارتفعت درجات الحرارة في تقرير المناخ السنوي عن معدلاتها المسجلة خلال العقد الماضي، بحسب بيانات المركز الوطني للأرصاد.');
  await page.getByRole('button',{name:'أضف المصدر',exact:true}).click();
  await page.getByLabel('سؤالك',{exact:true}).fill('درجات الحرارة');
  await page.getByRole('button',{name:'اسأل بجيمناي',exact:true}).click();
  await page.locator('#ragResult .src-card').first().waitFor();
  await new Promise(r=>setTimeout(r,1200));
  const probe=await page.evaluate(()=>{
    const card=document.querySelector('#ragResult .src-card');
    const strong=card.querySelector('strong');
    const small=card.querySelector('small');
    const bq=card.querySelector('blockquote');
    const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cs=getComputedStyle(card), ss=getComputedStyle(strong), ms=getComputedStyle(small), bs=bq?getComputedStyle(bq):null;
    return {reducedMotion:rm, cardOpacity:cs.opacity, cardBg:cs.backgroundColor, strongColor:ss.color, strongOpacity:ss.opacity, smallColor:ms.color, bqColor:bs&&bs.color, bqOpacity:bs&&bs.opacity, anim:cs.animationName};
  });
  console.log(JSON.stringify(probe,null,1));
 } finally { if(browser) await browser.close(); server.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1});
