/* Task file: save items into the local verification case (osint-verification-v2). Local only, no sync. */
(function(){"use strict";
 var KEY='osint-verification-v2',TYPES=['unknown','official','media','social','database','other'];
 function uid(){return (crypto.randomUUID&&crypto.randomUUID())||Date.now()+'-'+Math.random().toString(36).slice(2)}
 function now(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}
 function blank(){return{id:uid(),kind:'claim',title:'ملف مهمة',claim:'',checked:[],stepNotes:[],evidence:[],verdict:'pending',confidence:'undetermined',rationale:'',nextStep:'',forensics:'',created:new Date().toISOString(),updated:new Date().toISOString()}}
 function load(){try{var v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&Array.isArray(v.cases))return v}catch(e){}return{cases:[],active:''}}
 function trim(s,n){return String(s==null?'':s).slice(0,n)}
 function add(item){
  var url=trim(item.url,2000);if(url&&!/^https?:\/\//i.test(url))url='';
  var data=load(),c=data.cases.find(function(x){return x.id===data.active})||data.cases[0];
  if(!c){c=blank();data.cases.push(c)}
  data.active=c.id;
  if(c.evidence.length>=300)return {ok:false,reason:'full'};
  var dup=c.evidence.some(function(e){return e.name===trim(item.name,180)&&e.url===url});
  if(dup)return {ok:true,duplicate:true};
  c.evidence.push({id:uid(),name:trim(item.name,180)||'عنصر بلا عنوان',url:url,type:TYPES.indexOf(item.type)>=0?item.type:'unknown',direction:'unclear',access:now(),note:trim(item.note,3000)||'أُضيف من '+trim(item.from||document.title,80)+'. لم تُراجع بعد.'});
  c.updated=new Date().toISOString();
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){return {ok:false,reason:'storage'}}
  return {ok:true}
 }
 function toast(res){
  var t=document.createElement('div');t.className='tf-toast';t.setAttribute('role','status');
  t.textContent=!res.ok?'تعذر الحفظ المحلي في هذا المتصفح':res.duplicate?'العنصر موجود في الحالة مسبقًا':'أُضيف إلى الحالة (محفوظ على جهازك فقط)';
  if(res.ok){var a=document.createElement('a');a.href='./verification.html#workspace';a.textContent='افتح الحالة';t.append(a)}
  document.body.append(t);setTimeout(function(){t.remove()},4500)
 }
 function button(item){
  var b=document.createElement('button');b.type='button';b.className='tf-btn';b.textContent='أضف إلى الحالة';
  b.addEventListener('click',function(e){e.stopPropagation();var it=typeof item==='function'?item():item;var r=add(it);toast(r)});
  return b
 }
 window.OSINTTaskFile={add:add,button:button};
})();
