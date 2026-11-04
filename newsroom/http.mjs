import{institutionOverview}from'./institution-overview.mjs';
import{produceReport}from'./produce-report.mjs';
import{runPublicDemonstration}from'./public-demonstration.mjs';
import{TaskExecutor}from'./task-executor.mjs';
import{existingWorkerPlanner}from'./existing-worker-planner.mjs';
import{tableAdapters}from'./table-analysis.mjs';
import{proposePlan,PlanningUnavailable}from'./planning-bridge.mjs';
import{searchCapabilities,capabilityContract}from'./capability-registry.mjs';
/* Staged API only. Not included in existing AI Worker or deployed automatically. */
import {authenticateAccess,Unauthenticated} from './access-auth.mjs';
import {OfficeService,Denied,Conflict,Invalid} from './d1-service.mjs';
import {WorkflowRunner,WorkflowConflict,WorkflowBlocked} from './workflow-runner.mjs';
import {suppliedSourceAdapters,normalizeSources} from './source-adapters.mjs';
import {D1WorkflowStore} from './workflow-store.mjs';
const reply=(status,body,origin)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});
export function createHandler({authenticate=authenticateAccess,service=db=>new OfficeService(db),workflow=db=>new WorkflowRunner({store:new D1WorkflowStore(db),office:service(db),adapters:id=>id==='local-source-extract-v1'?suppliedSourceAdapters():id==='local-csv-statistics-v1'?tableAdapters():null})}={}){
 return async(request,env)=>{
  const origin=request.headers.get('origin');
  // Server-managed exact origin, never reflected without equality. No cookie-auth CORS.
  if(!env.DB||!env.ACCESS_ISSUER||!env.ACCESS_AUDIENCE||!env.APP_ORIGIN)return reply(503,{error:'service_not_configured'});
  if(origin&&origin!==env.APP_ORIGIN)return reply(403,{error:'origin_not_allowed'});
  const cors=origin===env.APP_ORIGIN?origin:null;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors?{'access-control-allow-origin':cors,'access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'Content-Type,Cf-Access-Jwt-Assertion','access-control-max-age':'600','vary':'Origin'}:{}});
  try{
   const identity=await authenticate(request,{issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUDIENCE});
   const session=new URL(request.url).pathname.match(/^\/v1\/institutions\/([a-zA-Z0-9-]{1,64})\/session$/);if(session){if(request.method!=='GET')return reply(405,{error:'method_not_allowed'},cors);return reply(200,{tenant:session[1],role:await service(env.DB).role(identity.principal,session[1])},cors)}
   const overviewPath=new URL(request.url).pathname.match(/^\/v1\/institutions\/([a-zA-Z0-9-]{1,64})\/overview$/);if(overviewPath){if(request.method!=='GET')return reply(405,{error:'method_not_allowed'},cors);return reply(200,await institutionOverview({principal:identity.principal,tenant:overviewPath[1],office:service(env.DB),store:new D1WorkflowStore(env.DB),db:env.DB,env}),cors)}
   const capabilityPath=new URL(request.url).pathname.match(/^\/v1\/institutions\/([a-zA-Z0-9-]{1,64})\/capabilities(?:\/([a-zA-Z0-9-]{1,80}))?$/);if(capabilityPath){if(request.method!=='GET')return reply(405,{error:'method_not_allowed'},cors);await service(env.DB).role(identity.principal,capabilityPath[1]);return reply(200,capabilityPath[2]?capabilityContract(capabilityPath[2]):searchCapabilities(new URL(request.url).searchParams.get('q')||''),cors)}
   const path=new URL(request.url).pathname.match(/^\/v1\/institutions\/([a-zA-Z0-9-]{1,64})\/(files|workflows|plans|public-demo|produce-report)(?:\/([a-zA-Z0-9-]{1,64}))?(\/(?:review|advance|materialize|submit|reconcile|pause|resume|branch|replan))?$/);
   if(!path)return reply(404,{error:'not_found'},cors);
   const [,tenant,resource,id,tail]=path,principal=identity.principal;
   if(resource==='plans'||resource==='public-demo'||resource==='produce-report'){if(request.method!=='POST'||id||tail)return reply(405,{error:'method_not_allowed'},cors);await service(env.DB).role(principal,tenant,['owner','editor'])}
   const isWorkflow=resource==='workflows',review=tail==='/review',store=isWorkflow?workflow(env.DB):service(env.DB);
   if(isWorkflow&&request.method==='GET')return reply(200,id?await store.read(principal,tenant,id):{runs:await store.list(principal,tenant)},cors);
   if(!isWorkflow&&tail&&!review)return reply(404,{error:'not_found'},cors);
   if(review&&!id)return reply(404,{error:'not_found'},cors);
   if(request.method==='GET'&&review)return reply(200,await store.reviewState(principal,tenant,id),cors);
   if(!isWorkflow&&request.method==='GET')return reply(200,id?await store.read(principal,tenant,id):{files:await store.list(principal,tenant)},cors);
   if(!['POST','PUT'].includes(request.method))return reply(405,{error:'method_not_allowed'},cors);
   if(!cors)return reply(403,{error:'write_origin_required'});
   if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply(415,{error:'json_required'},cors);
   if(Number(request.headers.get('content-length'))>600000)return reply(413,{error:'file_too_large'},cors);
   const reader=request.body?.getReader();if(!reader)return reply(400,{error:'body_required'},cors);
   const chunks=[];let size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>600000){await reader.cancel();return reply(413,{error:'file_too_large'},cors)}chunks.push(value)}
   const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}
   let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{return reply(400,{error:'invalid_json'},cors)}
   if(!body||typeof body!=='object')return reply(400,{error:'invalid_json'},cors);
   if(resource==='produce-report')return reply(201,await produceReport({principal,tenant,brief:body.brief,sourceInputs:body.sourceInputs,office:service(env.DB),store:new D1WorkflowStore(env.DB)}),cors);
   if(resource==='public-demo')return reply(201,await runPublicDemonstration({principal,tenant,office:service(env.DB),store:new D1WorkflowStore(env.DB),env}),cors);
   if(resource==='plans')return reply(200,await proposePlan({question:body.question,capabilityIds:body.capabilityIds},{...env,PLANNER:env.PLANNER||(env.INSTITUTION_PLANNER_ENABLED==='true'?existingWorkerPlanner(env):undefined)}),cors);
   // Body principal/tenant claims are not consulted.
   if(isWorkflow&&request.method==='POST'&&!id&&!tail&&body.executionPlan)return reply(201,await new TaskExecutor({store:new D1WorkflowStore(env.DB),office:service(env.DB)}).create({principal,tenant,brief:body.brief,sourceInputs:body.sourceInputs,plan:body.executionPlan}),cors);
   if(isWorkflow&&request.method==='POST'&&['/advance','/materialize','/replan'].includes(tail)){const run=await store.read(principal,tenant,id);if(run.kind==='bounded-task')return reply(200,await new TaskExecutor({store:new D1WorkflowStore(env.DB),office:service(env.DB)})[tail.slice(1)](principal,tenant,id,body),cors)}
   if(isWorkflow){if(request.method!=='POST')return reply(405,{error:'method_not_allowed'},cors);if(!id&&!tail)return reply(201,await store.create({principal,tenant,brief:body.brief,sourceInputs:normalizeSources(body.sourceInputs),...(body.capabilityId?{capabilityId:body.capabilityId}:{})}),cors);const action=tail?.slice(1);if(!id||!['advance','materialize','submit','reconcile','pause','resume','branch'].includes(action))return reply(404,{error:'not_found'},cors);return reply(200,await store[action](principal,tenant,id),cors)}
   if(review){if(request.method!=='POST')return reply(405,{error:'method_not_allowed'},cors);return reply(200,await store.transition(principal,tenant,id,body.expectedVersion,body.action),cors)}
   if(request.method==='POST'&&!id)return reply(201,await store.create(principal,tenant,body.file),cors);
   if(request.method==='PUT'&&id)return reply(200,await store.save(principal,tenant,id,body.expectedVersion,body.file),cors);
   return reply(405,{error:'method_not_allowed'},cors);
  }catch(e){if(e instanceof PlanningUnavailable)return reply(e.reason==='invalid_plan_request'?400:503,{error:e.reason},cors);if(e instanceof Unauthenticated)return reply(401,{error:'authentication_required'},cors);if(e instanceof Denied)return reply(403,{error:'not_permitted'},cors);if(e instanceof WorkflowBlocked)return reply(400,{error:'workflow_blocked'},cors);if(e instanceof WorkflowConflict)return reply(409,{error:'inspect_workflow_before_retry'},cors);if(e instanceof Conflict)return reply(409,{error:'reload_before_saving'},cors);if(e instanceof Invalid)return reply(400,{error:e.message},cors);return reply(503,{error:'temporarily_unavailable'},cors)}
 }
}
export default {fetch:createHandler()};
