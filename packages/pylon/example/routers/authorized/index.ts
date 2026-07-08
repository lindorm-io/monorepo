import { PylonRouter, createAccessTokenMiddleware } from "../../../src/index.js";

export const router = new PylonRouter();

// Verifies the bearer access token and stores it on `ctx.state.tokens.accessToken`
// for the handlers under this router (see ./route.ts).
const accessTokenMiddleware = createAccessTokenMiddleware({
  issuer: "http://test.lindorm.io",
});

router.use(accessTokenMiddleware);
