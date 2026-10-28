// Claim-phrasing change surfacing for version comparison (original spec #4:
// تغيّر الادعاءات، مش مجرد اختلاف الكلمات). Rule: in a modified line pair, if
// the CHANGED tokens include attribution, negation, or absolutist words, that
// edit may alter what is claimed or who said it. A lead for manual review -
// the rule cannot judge whether the meaning actually changed.
const DIAC=/[ً-ٰٟ]/g;
const normTok=t=>String(t||'').replace(DIAC,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]/gu,'');
const ATTR=['قال','قالت','اعلن','اعلنت','زعم','زعمت','اكد','اكدت','ادعي','ادعت','صرح','صرحت','نفي','ينفي','نفت','ذكر','ذكرت','اوضح','اوضحت','افاد','افادت','كشف','كشفت','رجح','رجحت'];
const NEG=['لم','لن','ما','لا','ليس','ليست','دون','بدون','غير'];
const ABS=['اكبر','اصغر','اعلي','ادني','افضل','اسوأ','اكثر','اقل','الاول','الاولي','الوحيد','الوحيده','دائما','ابدا','مستحيل'];
const SET=new Set([...ATTR,...NEG,...ABS]);
function tokens(line){return String(line||'').split(/\s+/).map(normTok).filter(Boolean)}
function symDiff(a,b){
 const rb=[...b],onlyA=[];
 for(const x of a){const i=rb.indexOf(x);if(i<0)onlyA.push(x);else rb.splice(i,1)}
 return{onlyA,onlyB:rb}}
export function claimChanges(ops,A,B,{limit=30}={}){
 if(!Array.isArray(ops)||!Array.isArray(A)||!Array.isArray(B))throw Error('مدخلات غير صالحة');
 const out=[];
 for(const o of ops){
  if(out.length>=limit)break;
  if(o.t!=='mod')continue;
  const d=symDiff(tokens(A[o.a]),tokens(B[o.b]));
  const hits=[...new Set([...d.onlyA,...d.onlyB].filter(t=>SET.has(t)))];
  if(hits.length)out.push({aLine:o.a+1,bLine:o.b+1,changedSensitive:hits,oldText:A[o.a],newText:B[o.b]})}
 return out}
