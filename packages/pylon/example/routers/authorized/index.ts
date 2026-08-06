import { PylonRouter, createAccessTokenMiddleware } from "../../../src/index.js";

export const router = new PylonRouter();

// Resolves the bearer access token onto `ctx.state.access` for the handlers
// under this router (see ./route.ts). A JOSE/COSE token is verified locally and
// also lands on `ctx.state.tokens.accessToken`; an opaque one is introspected.
const accessTokenMiddleware = createAccessTokenMiddleware({
  issuer: "http://test.lindorm.io",
});

router.use(accessTokenMiddleware);
