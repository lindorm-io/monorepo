import { PylonRouter, createHttpBearerTokenMiddleware } from "../../../src/index.js";

export const router = new PylonRouter();

const httpBearerTokenMiddleware = createHttpBearerTokenMiddleware({
  issuer: "http://test.lindorm.io",
  tokenType: "access_token",
});

router.use(httpBearerTokenMiddleware);
