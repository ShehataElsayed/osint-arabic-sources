// Number-change surfacing for version comparison (original spec #4: surface
// changed numbers with before/after text, not just word diffs). Pure rules over
// the comparison ops: numeric tokens are matched as multisets per modified line
// pair and across fully added/removed lines. This is token arithmetic, not a
// claim check: a changed number is a review lead, never a verdict.
const NUM=/[0-9٠-٩]+(?:[.,/٫:%-][0-9٠-٩]+)*/g;
export function numberTokens(line){
 if(typeof line!=='string')throw Error('سطر غير صالح');
 const out=[];let m;NUM.lastIndex=0;
 while((m=NUM.exec(line)))out.push(m[0]);
 return out}
function multisetDiff(a,b){
 const rest=[...b],removed=[];
 for(const x of a){const i=rest.indexOf(x);if(i<0)removed.push(x);else rest.splice(i,1)}
 return{removed,added:rest}}
// ops: [{t:'mod'|'add'|'del'|'same',a?,b?}], A and B are the line arrays.
export function numberChanges(ops,A,B,{limit=50}={}){
 if(!Array.isArray(ops)||!Array.isArray(A)||!Array.isArray(B))throw Error('مدخلات غير صالحة');
 const changes=[];let onlyAdded=0,onlyRemoved=0;
 for(const o of ops){
  if(changes.length>=limit)break;
  if(o.t==='mod'){
   const d=multisetDiff(numberTokens(A[o.a]),numberTokens(B[o.b]));
   if(d.removed.length||d.added.length)changes.push({aLine:o.a+1,bLine:o.b+1,removed:d.removed,added:d.added,oldText:A[o.a],newText:B[o.b]})}
  else if(o.t==='del')onlyRemoved+=numberTokens(A[o.a]).length;
  else if(o.t==='add')onlyAdded+=numberTokens(B[o.b]).length}
 return{changes,onlyAdded,onlyRemoved,truncated:changes.length>=limit}}
