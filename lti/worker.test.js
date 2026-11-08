import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from './worker.js';
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
let pass=0, fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('  FAIL:',m);} };

// a fake platform: a JWKS server + a keypair to sign id_tokens
const { publicKey, privateKey } = await generateKeyPair('RS256',{extractable:true});
const pub = await exportJWK(publicKey); pub.kid='plat-1'; pub.alg='RS256'; pub.use='sig';
const server = http.createServer((req,res)=>{ res.setHeader('content-type','application/json'); res.end(JSON.stringify({keys:[pub]})); });
await new Promise(r=>server.listen(0,r)); const jwksUrl='http://127.0.0.1:'+server.address().port+'/jwks';
const ISS='https://canvas.test', CID='client-123', DEP='dep-1';
const env={ SITE:'https://fluidta.com', STATE_SECRET:'test-secret-long-enough', PLATFORMS: JSON.stringify({ [ISS+'|'+CID]:{ authorization_endpoint:'https://canvas.test/api/lti/authorize_redirect', jwks_uri:jwksUrl, deployment_ids:[DEP] } }) };

// 1) login initiation
let r = await worker.fetch(new Request('https://lti.fluidta.com/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({iss:ISS,client_id:CID,login_hint:'u1',target_link_uri:'https://fluidta.com/cosmic-ladder.html',lti_message_hint:'mh'})}), env);
ok(r.status===302,'login redirects'); const loc=new URL(r.headers.get('location')); const setc=r.headers.get('set-cookie');
ok(loc.origin+loc.pathname==='https://canvas.test/api/lti/authorize_redirect','login goes to platform authorize');
ok(loc.searchParams.get('response_mode')==='form_post'&&loc.searchParams.get('response_type')==='id_token','oidc params');
const nonce=loc.searchParams.get('nonce'), state=loc.searchParams.get('state'), cookieVal=setc.match(/lti_state=([^;]+)/)[1];
ok(loc.searchParams.get('redirect_uri')==='https://lti.fluidta.com/launch','redirect_uri is /launch');

// helper to mint an id_token
const mint = (over={}) => { const base={ [LTI+'message_type']:'LtiResourceLinkRequest', [LTI+'version']:'1.3.0', [LTI+'deployment_id']:DEP, [LTI+'roles']:[], [LTI+'resource_link']:{id:'rl1'}, [LTI+'custom']:{fta_page:'cosmic-ladder.html'}, nonce, ...over };
  return new SignJWT(base).setProtectedHeader({alg:'RS256',kid:'plat-1'}).setIssuedAt().setExpirationTime('5m').setIssuer(ISS).setAudience(CID).sign(privateKey); };
const doLaunch = async (token,st=state,ck=cookieVal)=> worker.fetch(new Request('https://lti.fluidta.com/launch',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cookie':'lti_state='+ck},body:new URLSearchParams({id_token:token,state:st})}), env);

// 2) good launch
r = await doLaunch(await mint()); ok(r.status===302,'good launch 302'); const d=r.status===302?new URL(r.headers.get('location')):null;
ok(d&&d.origin==='https://fluidta.com'&&d.pathname==='/cosmic-ladder.html','redirects to the custom page');
ok(d&&d.searchParams.get('embed')==='1'&&d.searchParams.get('lti')==='1','embed+lti flags set');

// 3) page from target_link_uri when no custom claim
r = await doLaunch(await mint({[LTI+'custom']:{}, [LTI+'target_link_uri']:'https://fluidta.com/two-halves.html'}));
ok(r.status===302&&new URL(r.headers.get('location')).pathname==='/two-halves.html','falls back to target_link_uri');

// 4) open-redirect guard: a bogus/off-site slug is refused
r = await doLaunch(await mint({[LTI+'custom']:{fta_page:'https://evil.com/x'}, [LTI+'target_link_uri']:'https://evil.com/x'}));
ok(r.status===400,'off-site page refused ('+r.status+')');
r = await doLaunch(await mint({[LTI+'custom']:{fta_page:'../secret'}}));
ok(r.status===400,'path traversal refused ('+r.status+')');

// 5) tamper: wrong nonce, wrong state, wrong audience, wrong message type
r = await doLaunch(await mint({nonce:'nope'})); ok(r.status===400,'wrong nonce refused');
r = await doLaunch(await mint(), 'wrong-state'); ok(r.status===400,'wrong state refused');
r = await doLaunch(await new SignJWT({[LTI+'message_type']:'LtiResourceLinkRequest',nonce}).setProtectedHeader({alg:'RS256',kid:'plat-1'}).setIssuedAt().setExpirationTime('5m').setIssuer(ISS).setAudience('other-client').sign(privateKey));
ok(r.status===400,'wrong audience refused');
r = await doLaunch(await mint({[LTI+'message_type']:'LtiDeepLinkingRequest'})); ok(r.status===400,'non-resource-link refused');
// 6) forged token signed by a different key is rejected
const other=await generateKeyPair('RS256',{extractable:true});
r = await doLaunch(await new SignJWT({[LTI+'message_type']:'LtiResourceLinkRequest',[LTI+'deployment_id']:DEP,[LTI+'custom']:{fta_page:'cosmic-ladder.html'},nonce}).setProtectedHeader({alg:'RS256',kid:'plat-1'}).setIssuedAt().setExpirationTime('5m').setIssuer(ISS).setAudience(CID).sign(other.privateKey));
ok(r.status===400,'token signed by wrong key refused');

// 7) /config and /jwks endpoints
r = await worker.fetch(new Request('https://lti.fluidta.com/config'), env); const cfg=await r.json();
ok(cfg.oidc_initiation_url==='https://lti.fluidta.com/login','config oidc url'); ok(cfg.target_link_uri==='https://fluidta.com/','config target');
r = await worker.fetch(new Request('https://lti.fluidta.com/jwks'), {...env, TOOL_JWKS:JSON.stringify({keys:[pub]})}); const jw=await r.json();
ok(jw.keys&&jw.keys.length===1,'jwks served');

server.close(); console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
