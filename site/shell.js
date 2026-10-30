(function(){"use strict";
 var d=document;
 d.addEventListener('click',function(e){d.querySelectorAll('.shellnav details[open]').forEach(function(x){if(!x.contains(e.target))x.removeAttribute('open')})});
 d.addEventListener('keydown',function(e){if(e.key==='Escape')d.querySelectorAll('.shellnav details[open]').forEach(function(x){x.removeAttribute('open')})});
 d.querySelectorAll('.shellnav details').forEach(function(x){x.addEventListener('toggle',function(){if(x.open)d.querySelectorAll('.shellnav details[open]').forEach(function(y){if(y!==x)y.removeAttribute('open')})})});
 // Mobile display fix (2026-10-30): publish the fixed composer's live height (--composer-h) so chat
 // content can always scroll fully clear of it, and the fixed bottom nav height (--shellnav-h) so the
 // composer docks exactly above the nav instead of overlapping it or floating with a gap.
 var cw=d.querySelector('.composer-wrap'), nav=d.querySelector('.topnav.shellnav');
 function setMetrics(){
   if(cw)d.documentElement.style.setProperty('--composer-h',(cw.offsetHeight+14)+'px');
   if(nav)d.documentElement.style.setProperty('--shellnav-h',(getComputedStyle(nav).position==='fixed'?nav.offsetHeight:0)+'px');
 }
 if(cw||nav){setMetrics();addEventListener('resize',setMetrics);if('ResizeObserver' in window&&cw)new ResizeObserver(setMetrics).observe(cw);}
})();
