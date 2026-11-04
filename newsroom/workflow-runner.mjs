import{assessOutput}from'./output-acceptance.mjs';
import{capabilityContract}from'./capability-registry.mjs';
/* Staged automation coordinator. No implicit tool access or publication adapter. */
export const STAGES=Object.freeze(['idea','research','sources','analysis','draft','package']);
export class WorkflowBlocked extends Error {}
export class WorkflowConflict extends Error {}
const clone=v=>structuredClone(v);
function validOutput(stage,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>100000)throw new WorkflowBlocked('stage output missing or too large');
 if(!Array.isArray(value.sources)||value.sources.length>500)throw new WorkflowBlocked('source records required');
 for(const s of value.sources){if(typeof s.id!=='string'||typeof s.content!=='string'||typeof s.origin!=='string'||!s.content.trim())throw new WorkflowBlocked('raw source provenance required')}
 if(stage!=='idea'&&!value.sources.length)throw new WorkflowBlocked('no source material; not a completed stage');
 if(typeof value.provider!=='string'||!value.provider.trim())throw new WorkflowBlocked('adapter/provider identity required');
 return clone(value);
}
export class WorkflowRunner {
 constructor({store,adapters,office}){this.store=store;this.adapters=adapters;this.office=office}
 async create({principal,tenant,brief,sourceInputs=[],capabilityId='local-source-extract-v1'}){await this.office.role(principal,tenant,['owner','editor']);if(typeof brief!=='string'||!brief.trim()||brief.length>12000)throw new WorkflowBlocked('brief required');const taskContract=capabilityContract(capabilityId);if(!taskContract.executionAllowed)throw new WorkflowBlocked('discovery-only capability cannot execute');return this.store.create({tenant,principal,brief,taskContract,sourceInputs:structuredClone(sourceInputs),revision:1,status:'ready',cursor:0,steps:[],outputFile:null})}
 async list(principal,tenant){await this.office.role(principal,tenant);return this.store.list(principal,tenant)}
 async read(principal,tenant,id){await this.office.role(principal,tenant);const run=await this.store.read(principal,tenant,id);if(!run)throw new WorkflowBlocked('run not available');return run}
 async advance(principal,tenant,id){
  await this.office.role(principal,tenant,['owner','editor']);const run=await this.store.read(principal,tenant,id);if(!run)throw new WorkflowBlocked('run not available');
  if(run.status!=='ready'&&run.status!=='blocked')throw new WorkflowConflict('run cannot advance; inspect current state');
  if(run.cursor>=STAGES.length)return clone(run);
  const stage=STAGES[run.cursor],set=typeof this.adapters==='function'?this.adapters(run.taskContract?.id):this.adapters,adapter=set?.[stage];if(typeof adapter!=='function')return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'blocked',error:'adapter_unavailable:'+stage});
  // Persist running before external work. An interrupted/ambiguous stage is not automatically retried.
  const claimed=await this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'running',error:null,activeStage:stage});
  let output;try{output=validOutput(stage,await adapter({brief:run.brief,previous:clone(run.steps),sourceInputs:clone(run.sourceInputs||[]),stage}));await this.office.role(principal,tenant,['owner','editor'])}catch(e){return this.store.compareAndSet(principal,tenant,id,claimed.revision,{...claimed,status:e instanceof WorkflowBlocked?'blocked':'uncertain',error:e instanceof WorkflowBlocked?e.message:'stage_failed_or_uncertain',activeStage:null})}
  // Only package output may become a reviewable Office document. This is still not publication.
  return this.store.compareAndSet(principal,tenant,id,claimed.revision,{...claimed,status:run.cursor+1===STAGES.length?'awaiting_materialization':'ready',cursor:run.cursor+1,activeStage:null,steps:[...run.steps,{stage,output,completedAt:new Date().toISOString()}]});
 }
 async pause(principal,tenant,id){await this.office.role(principal,tenant,['owner','editor']);const run=await this.read(principal,tenant,id);if(run.status!=='ready')throw new WorkflowConflict('pause only at confirmed stage boundary');return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'paused',pausedAt:new Date().toISOString()})}
 async resume(principal,tenant,id){await this.office.role(principal,tenant,['owner','editor']);const run=await this.read(principal,tenant,id);if(run.status!=='paused')throw new WorkflowConflict('only explicit paused run may resume');return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'ready',resumedAt:new Date().toISOString()})}
 async branch(principal,tenant,id){await this.office.role(principal,tenant,['owner','editor']);const run=await this.read(principal,tenant,id);if(['running','uncertain','materializing','submitting'].includes(run.status))throw new WorkflowConflict('branch needs confirmed stable input snapshot');return this.store.create({tenant,principal,brief:run.brief+' / مسار جديد',sourceInputs:clone(run.sourceInputs),taskContract:clone(run.taskContract),revision:1,status:'paused',cursor:0,steps:[],outputFile:null,branchOf:{id:run.id,revision:run.revision},createdAt:new Date().toISOString()})}
 async materialize(principal,tenant,id){
  await this.office.role(principal,tenant,['owner','editor']);const run=await this.store.read(principal,tenant,id);if(!run||run.status!=='awaiting_materialization'||run.cursor!==STAGES.length)throw new WorkflowConflict('complete package required');
  const acceptance=assessOutput(run.taskContract?.id,run.steps.at(-1).output);if(!acceptance.passed)throw new WorkflowBlocked('output acceptance incomplete; inspect failed checks');
  const claimed=await this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'materializing'});
  const output=run.steps.at(-1).output,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try{const file=await this.office.create(principal,tenant,{kind:'doc',name:run.taskContract?.id==='local-csv-statistics-v1'?'تقرير وصفي للجدول المقدم':'حزمة تحرير مؤتمتة للمراجعة',data:{html:output.summary.split('\n').map(line=>'<p>'+esc(line||' ')+'</p>').join('')},provenanceCase:{workflowRun:id,brief:run.brief,taskContract:clone(run.taskContract),evidenceAudit:clone(output.evidenceAudit),outputAcceptance:acceptance,stages:clone(run.steps),sources:clone(output.sources)}});return await this.store.compareAndSet(principal,tenant,id,claimed.revision,{...claimed,status:'awaiting_human_submission',outputFile:file})}catch{throw new WorkflowConflict('materialization uncertain; reconcile before any retry')}
 }
 async submit(principal,tenant,id){await this.office.role(principal,tenant,['owner','editor']);const run=await this.store.read(principal,tenant,id);if(!run||run.status!=='awaiting_human_submission'||!run.outputFile)throw new WorkflowConflict('current materialized package required');const claim=await this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'submitting'});try{const review=await this.office.transition(principal,tenant,run.outputFile.id,run.outputFile.version,'submit');return await this.store.compareAndSet(principal,tenant,id,claim.revision,{...claim,status:'awaiting_human_review',review})}catch{throw new WorkflowConflict('submission uncertain; reconcile server review before retry')}}
 async reconcile(principal,tenant,id){
  await this.office.role(principal,tenant,['owner','editor']);const run=await this.read(principal,tenant,id);
  if(run.status==='materializing'){const matches=await this.office.workflowOutputs(principal,tenant,id);if(matches.length!==1)throw new WorkflowConflict('materialization not uniquely confirmed; no retry');return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:'awaiting_human_submission',outputFile:{id:matches[0].id,version:matches[0].version},reconciledAt:new Date().toISOString()})}
  if(['submitting','awaiting_human_review','awaiting_human_submission','human_approved','human_rejected','human_changes_requested'].includes(run.status)&&run.outputFile){const file=await this.office.read(principal,tenant,run.outputFile.id),review=await this.office.reviewState(principal,tenant,run.outputFile.id);if(review.version!==file.version)throw new WorkflowConflict('review version changed; reload');if(file.version!==run.outputFile.version){if(!['draft','in_review','approved','changes_requested','rejected'].includes(review.state))throw new WorkflowConflict('current review unconfirmed');return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,outputFile:{id:file.id,version:file.version},status:review.state==='draft'?'awaiting_human_submission':review.state==='in_review'?'awaiting_human_review':'human_'+review.state,review,reconciledAt:new Date().toISOString()})}if(!['in_review','approved','changes_requested','rejected'].includes(review.state))throw new WorkflowConflict('submission not confirmed');return this.store.compareAndSet(principal,tenant,id,run.revision,{...run,status:review.state==='in_review'?'awaiting_human_review':'human_'+review.state,review,reconciledAt:new Date().toISOString()})}
  throw new WorkflowConflict('no safely reconcilable operation; operator inspection required');
 }
 // Deliberately no publish method, output destination or final-human-decision adapter.
}
