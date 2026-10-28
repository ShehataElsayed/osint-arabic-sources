// Rule-based timeline review: conflict and gap SURFACING for human review.
// Rules only flag review leads; they never decide which date is true.
const DIAC=/[ً-ٰٟ]/g;
function norm(s){return String(s||'').replace(DIAC,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase()}
// Conflicts: events whose normalized descriptions match but dates differ.
export function findConflicts(events,{limit=20}={}){
 if(!Array.isArray(events))throw Error('أحداث غير صالحة');
 const groups=new Map();
 for(const e of events){
  const k=norm(e.text).slice(0,80);
  if(k.length<8)continue;
  if(!groups.has(k))groups.set(k,[]);
  groups.get(k).push(e)}
 const out=[];
 for(const g of groups.values()){
  const dates=[...new Set(g.map(e=>e.date).filter(Boolean))];
  if(dates.length>1)out.push({dates,items:g.map(e=>({date:e.date||'غير محسوم',text:e.text,quote:e.quote||''}))});
  if(out.length>=limit)break}
 return out}
// Gaps: conspicuous empty stretches between consecutive dated events.
export function findGaps(events,{limit=20}={}){
 if(!Array.isArray(events))throw Error('أحداث غير صالحة');
 const dated=events.filter(e=>e.date).map(e=>({...e,t:Date.parse(e.date)})).filter(e=>!isNaN(e.t)).sort((a,b)=>a.t-b.t);
 if(dated.length<3)return[];
 const spanDays=(dated[dated.length-1].t-dated[0].t)/86400000;
 const threshold=Math.max(14,spanDays/4);
 const out=[];
 for(let i=1;i<dated.length;i++){
  const days=Math.round((dated[i].t-dated[i-1].t)/86400000);
  if(days>=threshold)out.push({from:dated[i-1].date,to:dated[i].date,days,fromText:dated[i-1].text,toText:dated[i].text});
  if(out.length>=limit)break}
 return out}
