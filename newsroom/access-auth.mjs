/* Staged adapter. Deployment pins issuer/audience; membership checks follow auth. */
import {jwtVerify,importJWK} from 'jose';
import {createKeyFetcher} from './key-cache.mjs';
const cachedKeys=createKeyFetcher();
export class Unauthenticated extends Error {}
export async function authenticateAccess(request,{issuer,audience,fetchKeys=cachedKeys,now=()=>Date.now()/1000}={}) {
 let url;try{url=new URL(issuer)}catch{throw new Unauthenticated('authentication not configured')}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.cloudflareaccess.com')||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!audience)throw new Unauthenticated('authentication not configured');
 const token=request.headers.get('cf-access-jwt-assertion');if(!token||token.length>16384)throw new Unauthenticated('authentication required');
 try{
  const {payload}=await jwtVerify(token,async header=>{
   if(header.alg!=='RS256'||typeof header.kid!=='string'||header.jku||header.jwk||header.x5u||header.crit)throw Error();
   const response=await fetchKeys(new URL('/cdn-cgi/access/certs',url).href,{redirect:'error'});if(!response.ok)throw Error();
   const body=await response.json();if(!Array.isArray(body.keys)||body.keys.length>32)throw Error();
   const keys=body.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));if(keys.length!==1)throw Error();
   return importJWK(keys[0],'RS256');
  },{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','exp','iss','aud'],currentDate:new Date(now()*1000)});
  if(typeof payload.sub!=='string'||!payload.sub.trim())throw Error();
  return Object.freeze({principal:issuer+'|'+payload.sub});
 }catch{throw new Unauthenticated('invalid authentication')}
}
