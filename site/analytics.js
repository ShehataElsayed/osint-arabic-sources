// Aggregate, query-free events. GoatCounter records ordinary page views separately.
(function(){
  const endpoint='https://osint-arabic-sour.goatcounter.com/count';
  function event(path,title){
    if(window.goatcounter && typeof window.goatcounter.count==='function')
      window.goatcounter.count({path,title,event:true});
  }
  function key(url){
    // Stable URL hash avoids sending arbitrary URL query parameters to analytics.
    let value;try{let u=new URL(url,location.href);value=u.origin+u.pathname}catch{return null}
    let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }
  document.addEventListener('click',function(e){
    const a=e.target.closest && e.target.closest('a[data-osint-tool]');
    if(!a)return;
    const id=key(a.href);if(id)event('tool-'+id, a.dataset.osintTool.slice(0,120));
  });
  let searchTimer;
  document.addEventListener('input',function(e){
    const path=e.composedPath?e.composedPath():[e.target];
    const isPagefind=path.some(x=>x && x.localName==='pagefind-input');
    const el=path[0];
    if(!isPagefind && (!el || el.id!=='search'))return;
    clearTimeout(searchTimer);
    if(el.value && el.value.trim())searchTimer=setTimeout(()=>event(isPagefind?'search-pagefind':'search-directory','بحث داخل الدليل'),1200);
  });
  document.addEventListener('click',function(e){
    const el=e.target.closest && e.target.closest('#basic,#ai');
    if(el && document.getElementById('query')?.value.trim())event(el.id==='ai'?'search-semantic':'search-keywords','بحث أدوات الدليل');
  });
  const s=document.createElement('script');s.async=true;s.src='https://gc.zgo.at/count.js';s.dataset.goatcounter=endpoint;document.head.appendChild(s);
})();
