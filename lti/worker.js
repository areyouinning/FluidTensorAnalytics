/* FluidTA as an LTI 1.3 tool — a small Cloudflare Worker.
 *
 * FluidTA is a static site (GitHub Pages), which cannot receive the HTTP POST that an LTI launch
 * delivers the signed id_token in. This Worker is the one dynamic piece: it terminates the launch,
 * verifies the platform's signed token, and sends the browser on to the static page in embed mode.
 *
 * What it does: a content launch (LTI 1.3 Resource Link). A teacher adds a FluidTA page to a course;
 * a student clicks it; this Worker checks the launch is genuine and shows that page with no site chrome.
 *
 * What it does NOT do: grade passback (Assignment & Grade Services) or Deep Linking. Both need the tool
 * to sign its own service calls and to be a configured, stateful endpoint; they are noted at the bottom
 * as the extension points. For reading/doing an explainer or a game, a content launch is all you need.
 *
 * Routes (mount the Worker on a domain, e.g. lti.fluidta.com):
 *   GET|POST /login   OIDC third-party login initiation  -> redirect to the platform
 *   POST     /launch  the id_token lands here             -> verify, then 302 to the page in embed mode
 *   GET      /jwks    the tool's public keys              (some platforms require this at registration)
 *   GET      /config  a Canvas-style JSON config          (convenience for setup)
 *
 * Secrets / vars (set with `wrangler secret put` or in wrangler.toml [vars]):
 *   SITE          e.g. https://fluidta.com         the static site these launches open
 *   PLATFORMS     JSON: { "<iss>|<client_id>": { "authorization_endpoint": "...", "jwks_uri": "...",
 *                   "token_endpoint": "...", "deployment_ids": ["..."] }, ... }   (see README)
 *   STATE_SECRET  a long random string             signs the short-lived login state cookie
 *   TOOL_JWKS     JSON public JWK Set              (optional) the tool's public keys for /jwks
 */
import { jwtVerify, createRemoteJWKSet, SignJWT } from 'jose';

const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const PAGE_RE = /^[a-z0-9][a-z0-9-]*\.html$/;   // the only thing we will redirect to, under SITE: a page slug

const enc = new TextEncoder();
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
const bad = (msg, status = 400) => new Response(renderError(msg), { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

function platforms(env) { try { return JSON.parse(env.PLATFORMS || '{}'); } catch (e) { return {}; } }
function findPlatform(env, iss, clientId) {
  const p = platforms(env);
  if (clientId && p[iss + '|' + clientId]) return { cfg: p[iss + '|' + clientId], clientId };
  // fall back to a single registration for this issuer
  const keys = Object.keys(p).filter(k => k.split('|')[0] === iss);
  if (keys.length === 1) return { cfg: p[keys[0]], clientId: keys[0].split('|')[1] };
  return null;
}

/* the page to open: an explicit custom claim wins, else the tail of target_link_uri, else the home page */
function pageFrom(claims, targetLinkUri) {
  const custom = claims[LTI + 'custom'] || {};
  let slug = (custom.fta_page || custom.page || '').trim();
  if (!slug && targetLinkUri) { try { slug = new URL(targetLinkUri).pathname.replace(/^\//, ''); } catch (e) {} }
  slug = slug.replace(/^\/+/, '');
  if (slug === '' || slug === 'index.html') return 'index.html';
  return PAGE_RE.test(slug) ? slug : null;   // anything else is refused, so a launch can't point us off-site
}

async function stateCookie(env, data) {
  const key = enc.encode(env.STATE_SECRET || 'change-me');
  return await new SignJWT(data).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(key);
}
async function readState(env, token) {
  const key = enc.encode(env.STATE_SECRET || 'change-me');
  const { payload } = await jwtVerify(token, key);
  return payload;
}
const cookie = (name, val, maxAge) => `${name}=${val}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
function getCookie(req, name) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)')); return m ? m[1] : null; }
const rand = () => crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

async function params(req) {
  if (req.method === 'POST') { const f = await req.formData(); const o = {}; for (const [k, v] of f) o[k] = v; return o; }
  const o = {}; for (const [k, v] of new URL(req.url).searchParams) o[k] = v; return o;
}

/* ---- OIDC third-party login initiation ---- */
async function login(req, env) {
  const q = await params(req);
  const iss = q.iss, clientId = q.client_id;
  if (!iss) return bad('Login is missing the issuer (iss).');
  const found = findPlatform(env, iss, clientId);
  if (!found) return bad('This LMS (' + iss + ') is not registered with this tool. Add it to PLATFORMS.');
  const nonce = rand(), state = rand();
  const target = q.target_link_uri || '';
  const auth = new URL(found.cfg.authorization_endpoint);
  const r = auth.searchParams;
  r.set('scope', 'openid'); r.set('response_type', 'id_token'); r.set('response_mode', 'form_post');
  r.set('prompt', 'none'); r.set('client_id', found.clientId);
  r.set('redirect_uri', new URL('/launch', req.url).toString());
  r.set('login_hint', q.login_hint || ''); r.set('nonce', nonce); r.set('state', state);
  if (q.lti_message_hint) r.set('lti_message_hint', q.lti_message_hint);
  const signed = await stateCookie(env, { state, nonce, iss, clientId: found.clientId, target });
  return new Response(null, { status: 302, headers: { location: auth.toString(), 'set-cookie': cookie('lti_state', signed, 600) } });
}

/* ---- the launch: verify the id_token, then hand off to the static page ---- */
async function launch(req, env) {
  const q = await params(req);
  if (!q.id_token || !q.state) return bad('The launch did not include a token. Start from the LMS, not by opening this URL directly.');
  const sc = getCookie(req, 'lti_state');
  if (!sc) return bad('The launch session expired or third-party cookies are blocked. Open the activity in a new tab and try again.');
  let st;
  try { st = await readState(env, sc); } catch (e) { return bad('The launch state could not be verified.'); }
  if (st.state !== q.state) return bad('The launch state did not match (a possible cross-site request). Try again from the LMS.');

  const found = findPlatform(env, st.iss, st.clientId);
  if (!found) return bad('Unknown issuer at launch.');
  const JWKS = createRemoteJWKSet(new URL(found.cfg.jwks_uri));
  let claims;
  try {
    const res = await jwtVerify(q.id_token, JWKS, { issuer: st.iss, audience: st.clientId });
    claims = res.payload;
  } catch (e) { return bad('The launch token failed verification: ' + e.message); }
  if (claims.nonce !== st.nonce) return bad('The launch nonce did not match.');
  if (claims[LTI + 'message_type'] !== 'LtiResourceLinkRequest') return bad('This tool only handles resource-link launches.');
  const dep = claims[LTI + 'deployment_id'];
  if (found.cfg.deployment_ids && found.cfg.deployment_ids.length && found.cfg.deployment_ids.indexOf(dep) < 0)
    return bad('This deployment is not allowed.');

  const page = pageFrom(claims, claims[LTI + 'target_link_uri'] || st.target);
  if (!page) return bad('The launch did not name a FluidTA page to open.');
  const dest = new URL(env.SITE || 'https://fluidta.com');
  dest.pathname = '/' + page; dest.searchParams.set('embed', '1'); dest.searchParams.set('lti', '1');
  return new Response(null, { status: 302, headers: { location: dest.toString(), 'set-cookie': cookie('lti_state', '', 0) } });
}

function toolConfig(req, env) {
  const origin = new URL(req.url).origin;
  return {
    title: 'FluidTA', description: 'Interactive explainers and games in water, math and puzzles.',
    oidc_initiation_url: origin + '/login', target_link_uri: (env.SITE || 'https://fluidta.com') + '/',
    public_jwk_url: origin + '/jwks',
    extensions: [{ platform: 'canvas.instructure.com', settings: { placements: [
      { placement: 'link_selection', message_type: 'LtiResourceLinkRequest', target_link_uri: (env.SITE || 'https://fluidta.com') + '/' },
      { placement: 'assignment_selection', message_type: 'LtiResourceLinkRequest', target_link_uri: (env.SITE || 'https://fluidta.com') + '/' }
    ] } }],
    custom_fields: { fta_page: '$Canvas.file.id' }
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/$/, '') || '/';
    try {
      if (path === '/login') return await login(req, env);
      if (path === '/launch') return await launch(req, env);
      if (path === '/jwks') { let j = {}; try { j = JSON.parse(env.TOOL_JWKS || '{"keys":[]}'); } catch (e) {} return json(j); }
      if (path === '/config') return json(toolConfig(req, env));
      if (path === '/') return new Response(renderHome(env), { headers: { 'content-type': 'text/html; charset=utf-8' } });
      return new Response('Not found', { status: 404 });
    } catch (e) { return bad('LTI tool error: ' + e.message, 500); }
  }
};

function shell(title, body) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>:root{color-scheme:light dark}body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:10vh auto;padding:0 1.2rem;color:#1b1d21;background:#fcfbf9}
@media(prefers-color-scheme:dark){body{color:#eef1f4;background:#10161d}}a{color:#1459c7}code{background:#8882;padding:.1em .3em;border-radius:4px}</style>${body}`;
}
const renderError = msg => shell('LTI launch', `<h1>This didn't launch</h1><p>${String(msg).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</p><p>Open the activity from inside your course. If this keeps happening, your teacher can check the tool's setup.</p>`);
const renderHome = env => shell('FluidTA LTI tool', `<h1>FluidTA · LTI 1.3 tool</h1><p>This is the launch endpoint for embedding <a href="${env.SITE || 'https://fluidta.com'}">FluidTA</a> in a learning management system. It is not meant to be opened directly — add FluidTA to a course and launch it from there.</p><p>Setup lives in the repository under <code>lti/README.md</code>, and a teacher-facing guide is at <a href="${env.SITE || 'https://fluidta.com'}/lti.html">${(env.SITE || 'https://fluidta.com').replace(/^https?:\/\//, '')}/lti.html</a>.</p>`);
