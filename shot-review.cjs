const {chromium}=require('playwright');
const url=process.argv[2];
(async()=>{
  const b=await chromium.launch();
  for(const [name,w,h] of [['320',320,700],['390',390,844],['1280',1280,900]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.goto(url,{waitUntil:'networkidle',timeout:45000});
    await p.screenshot({path:`/downloads/review-${name}.png`,fullPage:true});
    console.log(name,'captured, page height:',await p.evaluate(()=>document.body.scrollHeight));
    await p.close();
  }
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
