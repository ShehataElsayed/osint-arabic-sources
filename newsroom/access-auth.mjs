/* Authentication adapter prototype. Caller pins deployment config, never request values.
   Not deployed. Membership and tenant authorization must follow authentication. */
export class Unauthenticated extends Error {}
const decode = part => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
export async function authenticateAccess(request, {issuer,audience,fetchKeys=fetch,now=()=>Date.now()/1000}={}) {
  let url;
  try {url=new URL(issuer)} catch {throw new Unauthenticated('authentication not configured')}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.cloudflareaccess.com')||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!audience)throw new Unauthenticated('authentication not configured');
  const token=request.headers.get('cf-access-jwt-assertion');
  if(!token||token.length>16384)throw new Unauthenticated('authentication required');
  try {
    const parts=token.split('.');if(parts.length!==3)throw Error();
    const header=decode(parts[0]),claims=decode(parts[1]);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||header.jku||header.jwk||header.x5u||header.crit)throw Error();
    if(claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||typeof claims.sub!=='string'||!claims.sub.trim()||typeof claims.exp!=='number'||claims.exp<=now()||(claims.nbf!==undefined&&(typeof claims.nbf!=='number'||claims.nbf>now())))throw Error();
    // Token cannot select a remote key endpoint or become an SSRF destination.
    const response=await fetchKeys(new URL('/cdn-cgi/access/certs',url).href,{redirect:'error'});
    if(!response.ok)throw Error();
    const body=await response.json();if(!Array.isArray(body.keys)||body.keys.length>32)throw Error();
    const matches=body.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
    if(matches.length!==1)throw Error();
    const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const sig=Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,sig,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error();
    return Object.freeze({principal:issuer+'|'+claims.sub});
  } catch {throw new Unauthenticated('invalid authentication')}
}
