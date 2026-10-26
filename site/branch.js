"use strict";
(function(){
  var input=document.getElementById('filter'),tools=[].slice.call(document.querySelectorAll('.tool')),sects=[].slice.call(document.querySelectorAll('.sect')),none=document.getElementById('none'),count=document.getElementById('count');
  var norm=function(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')};
  tools.forEach(function(t){t._q=norm(t.dataset.q)});
  function run(){
    var q=norm(input.value.trim()),n=0;
    tools.forEach(function(t){var ok=!q||q.split(/\s+/).every(function(w){return t._q.indexOf(w)>=0});t.hidden=!ok;if(ok)n++});
    sects.forEach(function(s){var any=s.querySelector('.tool:not([hidden])');s.hidden=!any;var c=s.querySelector('.sect-head small');if(c){var k=s.querySelectorAll('.tool:not([hidden])').length;c.textContent=k+' أداة'}});
    none.hidden=n>0;count.textContent=q?n+' أداة مطابقة داخل هذا الفرع':tools.length+' أداة في هذا الفرع';
  }
  input.addEventListener('input',run);run();
  document.querySelectorAll('.chips a').forEach(function(a){a.addEventListener('click',function(){if(input.value){input.value='';run()}})});
  if('IntersectionObserver' in window){
    var links={};document.querySelectorAll('.chips a').forEach(function(a){links[a.getAttribute('href').slice(1)]=a});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){Object.keys(links).forEach(function(k){links[k].classList.toggle('on',k===e.target.id)})}})},{rootMargin:'-90px 0px -65% 0px'});
    sects.forEach(function(s){io.observe(s)});
  }
  if(window.OSINTTaskFile){tools.forEach(function(t){if(!t.dataset.url)return;var box=t.querySelector('.acts');box.append(window.OSINTTaskFile.button(function(){return{name:t.dataset.name,url:t.dataset.url,type:'unknown',from:'صفحة فرع',note:'أداة من الدليل: '+t.dataset.desc+'. لم تُراجع بعد.'}}))})}
  document.addEventListener('keydown',function(e){if(e.key==='/'&&document.activeElement!==input&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();input.focus()}});
})();
