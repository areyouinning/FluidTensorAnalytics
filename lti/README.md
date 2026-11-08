# FluidTA as an LTI 1.3 tool

FluidTA is a static site (GitHub Pages). An LTI launch arrives as an HTTP POST carrying a signed
token, and static hosting cannot read a POST body — so the launch is terminated by this small
**Cloudflare Worker**, which verifies the launch and then redirects the browser to the requested
FluidTA page in **embed mode** (`?embed=1`, which hides the site's own navigation).

Two ways to use FluidTA in a course:

1. **Just an iframe / "embed external content".** Every page accepts `?embed=1` and drops its site
   chrome, so you can paste a URL like `https://fluidta.com/cosmic-ladder.html?embed=1` into any
   "embed" or "external URL" box. No server, no setup. This covers most classrooms.
2. **A real LTI 1.3 tool** (single sign-on, appears as a course activity) — deploy this Worker.

This tool does a **content launch** only: it shows the page. It does **not** send grades back
(Assignment & Grade Services) or use Deep Linking; those need the tool to sign its own service
calls and are left as the extension points noted at the end.

## Deploy the Worker

Prerequisites: a [Cloudflare](https://dash.cloudflare.com) account and Node.js.

```bash
cd lti
npm install
npx wrangler login
```

Set the secrets (never commit these):

```bash
# a long random string that signs the 10-minute login state cookie
npx wrangler secret put STATE_SECRET

# your LMS registrations, as JSON keyed by "<issuer>|<client_id>" (see below)
npx wrangler secret put PLATFORMS
```

Deploy:

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://fluidta-lti.<you>.workers.dev`. (To use your own
subdomain such as `lti.fluidta.com`, uncomment the `[[routes]]` block in `wrangler.toml`.)
Your three setup URLs are then:

| Field in the LMS                | Value                                             |
|---------------------------------|---------------------------------------------------|
| OpenID Connect Initiation URL   | `https://<worker>/login`                          |
| Redirect URI / Target Link URI  | `https://<worker>/launch`                         |
| Public JWK Set URL              | `https://<worker>/jwks`                           |

The Worker also serves `https://<worker>/config` — a Canvas-style JSON config you can paste where
an LMS accepts a configuration URL or JSON.

### The `PLATFORMS` secret

```json
{
  "https://canvas.instructure.com|10000000000123": {
    "authorization_endpoint": "https://sso.canvaslms.com/api/lti/authorize_redirect",
    "jwks_uri": "https://sso.canvaslms.com/api/lti/security/jwks",
    "token_endpoint": "https://sso.canvaslms.com/login/oauth2/token",
    "deployment_ids": ["one:abcd..."]
  }
}
```

The issuer, client ID, the three endpoints and the deployment ID all come from your LMS when you
register the tool (steps below). You may list several platforms. `token_endpoint` is only needed
if you later add grade passback; `deployment_ids` is optional (leave `[]` to accept any).

## Register in your LMS

**Canvas** (admin → Developer Keys → + LTI Key):
- Method: *Enter URL* → `https://<worker>/config`, or fill the fields by hand using the table above.
- After saving, copy the **Client ID** (a long number) and turn the key **On**. In a course,
  add an app with that Client ID. Canvas's issuer is `https://canvas.instructure.com`; its
  endpoints are on your Canvas's documentation page (Security → JWKs). Put issuer + client ID +
  endpoints into `PLATFORMS`.

**Moodle** (Site administration → Plugins → External tool → Manage tools → configure a tool manually):
- Tool URL `https://<worker>/launch`, LTI version *1.3*, Public keyset URL `https://<worker>/jwks`,
  Initiate login URL `https://<worker>/login`, Redirection URI `https://<worker>/launch`.
- After saving, open the tool's *Tool configuration details* for the **Platform ID** (issuer),
  **Client ID**, **Authentication request URL**, **Public keyset URL** and **Deployment ID**, and
  put them into `PLATFORMS`.

## Choosing which page a launch opens

In order:
1. a custom parameter `fta_page=<slug>.html` on the activity (e.g. `fta_page=hydrograph-synth.html`);
2. otherwise the tail of the launch's Target Link URI (set the activity's URL to
   `https://fluidta.com/<slug>.html`);
3. otherwise the home page.

Only a bare `name.html` slug on `fluidta.com` is ever redirected to — a launch cannot send a
student off-site (verified in `worker.test.js`).

## Generate the tool's keys (optional)

Some LMSs require a public JWK Set at registration even for a content-only tool:

```bash
node keygen.js
```

Set the printed public set as `TOOL_JWKS` (served at `/jwks`). Keep the private JWK only if you
extend the tool — a content launch never signs anything.

## Test

```bash
npm install   # jose is needed to run the tests
node worker.test.js
```

The tests stand up a fake platform with its own keypair and JWKS server and exercise the full
login → signed-launch → redirect path, plus the rejections: wrong nonce, wrong state, wrong
audience, a token signed by the wrong key, a non-resource-link message, and off-site/traversal
page slugs.

## Extending to grades or deep linking

- **Grade passback (AGS):** on launch, read the `…/claim/endpoint` (lineitem + scopes), get an
  access token from the platform's `token_endpoint` using a signed `client_assertion` (your
  private key from `keygen.js`), then POST a score. This makes the tool stateful and is out of
  scope here.
- **Deep Linking:** handle `LtiDeepLinkingRequest`, let the teacher pick a page, and return a
  signed `LtiDeepLinkingResponse` (again signed with your private key).
