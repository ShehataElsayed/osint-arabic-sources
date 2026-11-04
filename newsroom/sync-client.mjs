/* Opt-in sync experiment. Nothing imports this into the public editors yet. */
export class SyncConflict extends Error {}
export class SyncUnavailable extends Error {}
export class SyncClient {
 constructor({baseUrl,tenant,token,fetcher=fetch}){
  const url=new URL(baseUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!/^https:\/\/[a-z0-9.-]+\/?$/i.test(baseUrl)||!/^[a-zA-Z0-9-]{1,64}$/.test(tenant)||typeof token!=='function')throw Error('invalid sync configuration');
  this.base=url.origin;this.tenant=tenant;this.token=token;this.fetcher=fetcher;
 }
 async request(method,id,body,suffix=''){
  const jwt=await this.token();if(!jwt)throw new SyncUnavailable('sign in required');
  const headers={'cf-access-jwt-assertion':jwt};if(body)headers['content-type']='application/json';
  const url=this.base+'/v1/institutions/'+encodeURIComponent(this.tenant)+'/files'+(id?'/'+encodeURIComponent(id):'')+suffix;
  let response;try{response=await this.fetcher(url,{method,headers,credentials:'omit',redirect:'error',cache:'no-store',...(body?{body:JSON.stringify(body)}:{})})}catch{throw new SyncUnavailable('sync failed; local file unchanged')}
  if(response.status===409)throw new SyncConflict('remote file changed; keep both versions');
  if(!response.ok)throw new SyncUnavailable('sync unavailable; local file unchanged');
  return response.json();
 }
 async upload(local){
  // Deliberately no local-storage write or automatic retry after an ambiguous network error.
  const snapshot=structuredClone(local),remote=snapshot.remote;
  if(remote&&(remote.tenant!==this.tenant||remote.baseUrl!==this.base))throw new SyncUnavailable('remote belongs to another workspace; local file unchanged');
  const file={kind:snapshot.kind,name:snapshot.name,data:snapshot.data,provenanceCase:snapshot.provenanceCase,aiProvenance:snapshot.aiProvenance};
  const result=await this.request(remote?'PUT':'POST',remote?.id,{file,...(remote?{expectedVersion:remote.version}:{})});
  if(typeof result.id!=='string'||!Number.isInteger(result.version))throw new SyncUnavailable('invalid sync reply; local file unchanged');
  return {...snapshot,remote:{id:result.id,version:result.version,tenant:this.tenant,baseUrl:this.base},syncedAt:Date.now()};
 }
 async reviewState(id){return this.request('GET',id,undefined,'/review')}
 async transition(id,expectedVersion,action){return this.request('POST',id,{expectedVersion,action},'/review')}
 async download(id){return this.request('GET',id)}
 async list(){return this.request('GET')}
}
