/* Bounded per-isolate JWKS cache. Key rotation refreshes after TTL, failures fail closed. */
export function createKeyFetcher({fetcher=fetch,now=()=>Date.now(),ttlMs=300000,maxEntries=4}={}){
 const cache=new Map(),inflight=new Map();
 return async function fetchKeys(url,options){
  const old=cache.get(url);if(old&&old.until>now())return Response.json(old.body);
  if(!inflight.has(url))inflight.set(url,(async()=>{
   const response=await fetcher(url,{...options,signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('keys unavailable');
   const reader=response.body?.getReader();if(!reader)throw Error('keys unavailable');let text='',bytes=0;const decoder=new TextDecoder();while(true){const{value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>65536){await reader.cancel();throw Error('keys too large')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();const body=JSON.parse(text);if(!Array.isArray(body.keys)||body.keys.length>32)throw Error('invalid keys');
   if(cache.size>=maxEntries&&!cache.has(url))cache.delete(cache.keys().next().value);
   cache.set(url,{body,until:now()+ttlMs});return body;
  })().finally(()=>inflight.delete(url)));
  return Response.json(await inflight.get(url));
 }
}
