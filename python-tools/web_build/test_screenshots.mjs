import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
for(const [n,w,h,u] of [['home_mobile',390,800,'/'],['home_desktop',1280,800,'/'],['case_mobile',390,900,'/?demo#case']]){
 const p=await b.newPage();await p.setViewport({width:w,height:h,isMobile:w<500});await p.goto('http://localhost:8765'+u);
 await p.waitForFunction("document.getElementById('n').textContent.length>3",{timeout:60000});
 if(u.includes('case'))await p.waitForSelector('.rv',{timeout:60000});
 await new Promise(r=>setTimeout(r,400));await p.screenshot({path:'/downloads/w5_'+n+'.png',fullPage:u!='/'});}
await b.close();
