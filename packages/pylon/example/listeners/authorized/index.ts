import { PylonListener, createSocketBearerTokenMiddleware } from "../../../src";

export const listener = new PylonListener();

const socketBearerTokenMiddleware = createSocketBearerTokenMiddleware({
  issuer: "http://test.lindorm.io",
  tokenType: "access_token",
});

listener.use(socketBearerTokenMiddleware);
