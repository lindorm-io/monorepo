import { PylonRouter, useAccessToken } from "../../../src/index.js";

export const router = new PylonRouter();

// Resolves the bearer access token onto `ctx.state.access` for the handlers
// under this router (see ./route.ts). A claims-bearing token (JWT/CWT/CWM, or a
// sign-then-encrypt JWE/CWE) is verified locally and also lands on
// `ctx.state.tokens.accessToken`; an opaque credential — a bare handle or a
// signed-but-claimless JWS/CWS — is introspected instead.
// The issuer comes from `auth.driver` (see ../../_example.ts), so the same mount
// works here, on a socket listener, and on the handshake. The `audience` is the
// one thing a mount MUST state: it is this API's own identifier, the value a
// token must carry in `aud` (RFC 9068 §4 makes validating it mandatory), and
// nothing at boot knows what this deployment answers to.
router.use(useAccessToken({ audience: "http://test.lindorm.io/api" }));
