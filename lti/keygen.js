/* Generate the tool's signing keypair. Prints the public JWKS (for the LMS and the /jwks endpoint)
   and the private JWK (store it as a secret only if you later add grade passback or deep linking).
   Run: node keygen.js */
import { generateKeyPair, exportJWK } from 'jose';
const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
const pub = await exportJWK(publicKey), prv = await exportJWK(privateKey);
const kid = 'fta-' + Date.now();
pub.kid = prv.kid = kid; pub.alg = prv.alg = 'RS256'; pub.use = 'sig';
console.log('\n# Public JWKS — set as TOOL_JWKS, and give its URL (<worker>/jwks) to the LMS:\n');
console.log(JSON.stringify({ keys: [pub] }));
console.log('\n# Private JWK — keep secret; only needed for grade passback / deep linking (not for content launch):\n');
console.log(JSON.stringify(prv));
