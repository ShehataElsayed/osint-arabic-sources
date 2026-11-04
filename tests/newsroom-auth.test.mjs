import {test} from 'node:test';import assert from 'node:assert/strict';
import {authenticateAccess,Unauthenticated} from '../newsroom/access-auth.mjs';
const issuer='https://example-test.cloudflareaccess.com',audience='newsroom-test';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'};
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function token(claims={},header={}){const body=b64({alg:'RS256',kid:'test-key',...header})+'.'+b64({iss:issuer,aud:[audience],sub:'user-a',exp:2000,...claims});return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(body))).toString('base64url')}
function req(t){return new Request('https://example.test/api',{headers:t?{'cf-access-jwt-assertion':t}:{}})}
let calls=0;const config={issuer,audience,now:()=>1000,fetchKeys:async url=>{calls++;assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]})}};
test('valid pinned signature produces stable issuer/subject identity, not email or request body',async()=>{assert.deepEqual(await authenticateAccess(req(await token({email:'untrusted-change@example.test'})),config),{principal:issuer+'|user-a'})});
test('missing, unsigned, wrong audience, expired, future and forged identities fail closed',async()=>{for(const t of [null,'abc',await token({aud:['wrong']}),await token({exp:999}),await token({nbf:1001}),await token({iss:'https://evil.test'}),await token({sub:''}),await token({}, {alg:'none'}),(await token()).replace(/.$/,'!')])await assert.rejects(authenticateAccess(req(t),config),Unauthenticated)});
test('token-selected remote keys never fetched',async()=>{const before=calls;await assert.rejects(authenticateAccess(req(await token({}, {jku:'https://evil.test/keys'})),config),Unauthenticated);assert.equal(calls,before)});
test('invalid deployment config, unavailable and unknown keys fail closed',async()=>{const t=await token();for(const c of [{...config,issuer:'http://bad.test'},{...config,audience:''},{...config,fetchKeys:async()=>new Response('',{status:503})},{...config,fetchKeys:async()=>Response.json({keys:[]})}])await assert.rejects(authenticateAccess(req(t),c),Unauthenticated)});
