(function(){"use strict";
 var d=document;
 d.addEventListener('click',function(e){d.querySelectorAll('.shellnav details[open]').forEach(function(x){if(!x.contains(e.target))x.removeAttribute('open')})});
 d.addEventListener('keydown',function(e){if(e.key==='Escape')d.querySelectorAll('.shellnav details[open]').forEach(function(x){x.removeAttribute('open')})});
 d.querySelectorAll('.shellnav details').forEach(function(x){x.addEventListener('toggle',function(){if(x.open)d.querySelectorAll('.shellnav details[open]').forEach(function(y){if(y!==x)y.removeAttribute('open')})})});
})();
