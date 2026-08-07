import { PylonRouter, useAccessToken } from "../../../src/index.js";

export const router = new PylonRouter();

// Resolves the bearer access token onto `ctx.state.access` for the handlers
// under this router (see ./route.ts). A JOSE/COSE token is verified locally and
// also lands on `ctx.state.tokens.accessToken`; an opaque one is introspected.
// The issuer comes from `auth.driver` (see ../../_example.ts), so the same mount
// works here, on a socket listener, and on the handshake.
router.use(useAccessToken());
