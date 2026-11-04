/* Institution-to-existing-worker boundary. No secrets, arbitrary endpoint or private source forwarding. */
import{capabilityContract}from'./capability-registry.mjs';
export class PlanningUnavailable extends Error{constructor(reason){super(reason);this.reason=reason}}
export async function proposePlan({question,capabilityIds},env){
 if(!env.PLANNER||env.PLANNER_FREE_ONLY_CONFIRMED!=='true')throw new PlanningUnavailable('planner_not_verified');
 if(typeof question!=='string'||!question.trim()||question.length>300||!Array.isArray(capabilityIds)||!capabilityIds.length||capabilityIds.length>12||new Set(capabilityIds).size!==capabilityIds.length)throw new PlanningUnavailable('invalid_plan_request');
 const contracts=capabilityIds.map(capabilityContract),candidates=contracts.map((c,id)=>({id,name:c.name,description:[c.category,c.input,c.output].join('; ').slice(0,1200)}));
 let response;try{response=await env.PLANNER.fetch(new Request('https://planner.internal/',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'research_plan',question,candidates}),signal:AbortSignal.timeout(60000)}))}catch{throw new PlanningUnavailable('planner_connection_uncertain')}
 if(!response.ok)throw new PlanningUnavailable(response.status===429?'quota_exhausted':'planner_unavailable');
 const text=await response.text();if(text.length>50000)throw new PlanningUnavailable('planner_invalid_result');let value;try{value=JSON.parse(text)}catch{throw new PlanningUnavailable('planner_invalid_result')}
 if(!value.plan)throw new PlanningUnavailable(/429|quota/.test(value.reason||'')?'quota_exhausted':'planner_unavailable');
 const p=value.plan;if(!['gemini','workers-ai'].includes(p.provider)||!Array.isArray(p.steps)||!p.steps.length||p.steps.length>5)throw new PlanningUnavailable('planner_invalid_result');
 const safe=(v,n)=>typeof v==='string'&&v.trim()&&v.length<=n&&!/https?:|www\./i.test(v),seen=new Set();
 const steps=p.steps.map(s=>{if(!Number.isInteger(s.tool_id)||!contracts[s.tool_id]||seen.has(s.tool_id)||!safe(s.goal,200)||!safe(s.how,500))throw new PlanningUnavailable('planner_invalid_result');seen.add(s.tool_id);const c=contracts[s.tool_id];return{capabilityId:c.id,name:c.name,goal:s.goal,how:s.how,executionAllowed:c.executionAllowed,blockers:c.blockers||[],status:'proposed-not-executed'}});
 return{kind:'generated-proposal',provider:p.provider,createdAt:new Date().toISOString(),steps,question,limits:'Generated plan only. No external research, verification, service execution or publication has occurred.',dataScope:'question and selected public catalog descriptions only; source text excluded'};
}
