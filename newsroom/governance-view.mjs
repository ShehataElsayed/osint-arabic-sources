/* Consent-scoped metadata projection only. Not a cross-tenant read permission. */
export function governanceView(record,grant){
 if(!grant||grant.status!=='active'||grant.tenant!==record?.tenant||!Array.isArray(grant.fields))throw Error('explicit institution scope required');
 const allowed=new Set(grant.fields),out={tenant:record.tenant};
 if(allowed.has('workflow_state')){out.workflowId=record.id;out.status=record.status;out.completedStages=(record.steps||[]).map(s=>s.stage)}
 if(allowed.has('version_reference')&&record.outputFile)out.outputVersion={id:record.outputFile.id,version:record.outputFile.version};
 if(allowed.has('review_state')&&record.review)out.review={version:record.review.version,state:record.review.state};
 // Never include brief, content, source identities/text, actor principal, business terms or provider payloads.
 return out;
}
