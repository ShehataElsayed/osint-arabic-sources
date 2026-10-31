import{validateCase,textReport,TOOL_NAMES}from'../journalist-core.js';
import { BACKEND_URL, aiProviderName } from '../rag-config.js';
const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};let current=null,generation=0;
function download(name,body,type){const a=el('a'),u=URL.createObjectURL(new Blob([body],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function summary(){$('summary').textContent=current.sources.length+' مصدرًا و'+current.records.length+' سجلًا؛ '+current.records.filter(r=>r.review==='unreviewed').length+' غير مراجع.'}
function render(){const box=$('records');box.replaceChildren();const filter=$('filter').value,query=$('find').value.trim().toLocaleLowerCase();let shown=0;for(const r of current.records){if(filter!=='all'&&r.review!==filter)continue;if(query&&!(r.title+' '+r.note).toLocaleLowerCase().includes(query))continue;const card=el('article');card.className='case-record';card.dataset.id=r.id;card.append(el('h3',r.title),el('p',TOOL_NAMES[r.tool]||r.tool));
for(const a of r.anchors){const s=current.sources.find(s=>s.id===a.sourceId);card.append(el('p',s.title+' | '+a.start+'-'+a.end),el('blockquote',a.quote));if(s.url)card.append(el('p','رابط المصدر: '+s.url))}if(!r.anchors.length)card.append(el('p','لا اقتباس حرفي مربوط بمصدر لهذا السجل.'));
const label=el('label','حالة مراجعة السجل'),select=el('select');select.setAttribute('aria-label','مراجعة '+r.id);for(const[v,t]of[['unreviewed','لم أراجع'],['accepted','قبلت السجل'],['rejected','رفضت السجل']]){const o=el('option',t);o.value=v;select.append(o)}select.value=r.review;select.onchange=()=>{r.review=select.value;summary();if($('filter').value!=='all')render()};label.append(select);
const noteLabel=el('label','ملاحظات السجل (منفصلة عن الأصل)'),note=el('textarea');note.setAttribute('aria-label','ملاحظات '+r.id);note.value=r.note;note.maxLength=200000;note.oninput=()=>r.note=note.value;noteLabel.append(note);card.append(label,noteLabel);box.append(card);shown++}
$('count').textContent='يُعرض '+shown+' من '+current.records.length+' سجلًا. القائمة قابلة للتمرير، لا حذف للسجلات.';summary()}
function renderSources(){const box=$('sources');box.replaceChildren();for(const s of current.sources){const d=el('details'),sum=el('summary',s.title+' ('+s.text.length+' حرفًا)'),pre=el('pre',s.text);pre.className='case-source';d.append(sum,el('p','رابط المصدر: '+(s.url||'غير مسجل')),pre);box.append(d)}}
$('case-file').onchange=async()=>{const g=++generation;current=null;$('workspace').hidden=true;try{const f=$('case-file').files[0];if(!f){$('status').textContent='اختر قضية';return}if(f.size>5000000)throw Error('حد القضية5ميجابايت');const checked=validateCase(JSON.parse(await f.text()));if(g!==generation)return;current=checked;$('case-title').value=current.title;$('filter').value='all';$('find').value='';renderSources();render();$('workspace').hidden=false;$('status').textContent='فُتحت القضية محليًا. لا حفظ تلقائي؛ نزّل نسخة جديدة لحفظ تعديلاتك.'}catch(e){if(g===generation)$('status').textContent='لم تُفتح القضية: '+e.message}};
$('case-title').oninput=()=>{if(current)current.title=$('case-title').value};$('filter').onchange=$('find').oninput=()=>{if(current)render()};
$('export').onclick=()=>{try{if(!current)return;const checked=validateCase(current);download('journalist-case-reviewed.json',JSON.stringify(checked,null,2),'application/json');$('status').textContent='نُزلت نسخة جديدة مع المصادر والاقتباسات وحالات المراجعة. لم يتغير الأصل.'}catch(e){$('status').textContent='لم تُصدر القضية: '+e.message}};
$('report').onclick=()=>{if(current)download('journalist-case-report.txt',textReport(validateCase(current)),'text/plain;charset=utf-8')};

// AI summary of the open case (2026-10-31 all-tools AI expansion, user «تمام ضيفه ف كل
// الأدوات»): review stays fully local; this optional section sends ONLY the visible case text to
// the guide worker (summarize_text route, context 'case'). The worker guard blocks credibility /
// truth verdicts; the summary describes the case, and review states stay the reviewer's own marks.
(function aiSummary(){
  const ws=document.getElementById('workspace');
  new MutationObserver(()=>{const b=document.getElementById('ai-box'); if(b) b.hidden=ws.hidden; if(ws.hidden){const r=document.getElementById('ai-result'); if(r)r.hidden=true; const s=document.getElementById('ai-status'); if(s)s.textContent='';}}).observe(ws,{attributes:true,attributeFilter:['hidden']});
  const box=document.getElementById('ai-box'), btn=document.getElementById('ai-summarize'),
        st=document.getElementById('ai-status'), res=document.getElementById('ai-result'),
        prov=document.getElementById('ai-provider'), ov=document.getElementById('ai-overview'),
        qh=document.getElementById('ai-quotes-h'), ql=document.getElementById('ai-quotes');
  if(!box||!btn)return;
  btn.onclick=async()=>{
    const text=(document.getElementById('summary').textContent+'\n'+document.getElementById('workspace').innerText).slice(0,11000);
    if(text.trim().length<40){st.textContent='محتوى القضية أقصر من أن يُلخَّص.';return}
    btn.disabled=true;res.hidden=true;st.textContent='جارٍ التلخيص بالذكاء الاصطناعي…';
    try{
      const r=await fetch(BACKEND_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'summarize_text',text,context:'case'})});
      const j=r.ok?await r.json():null;
      const sm=j&&j.summary;
      if(!sm){st.textContent='الملخص بالذكاء الاصطناعي غير متاح الآن؛ قضيتك الكاملة ظاهرة أعلاه.';return}
      prov.textContent=aiProviderName(j&&j.provider);
      ov.textContent=sm.overview;
      ql.replaceChildren();
      if(Array.isArray(sm.key_quotes)&&sm.key_quotes.length){qh.hidden=false;for(const q of sm.key_quotes){const li=document.createElement('li');li.textContent=q;ql.append(li)}}else qh.hidden=true;
      res.hidden=false;
      st.textContent='اكتمل التلخيص بالذكاء الاصطناعي؛ الملخص بصياغة النموذج وصفٌ للقضية لا تقييم لمصادرها - راجعه أمام القضية قبل الاعتماد عليه.'}
    catch{st.textContent='تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ قضيتك الكاملة ظاهرة أعلاه.'}
    finally{btn.disabled=false}};
})();
