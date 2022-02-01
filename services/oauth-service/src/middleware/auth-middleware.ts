import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.server.host,
  subjectHint: "client",
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.server.host,
  subjectHint: "identity",
});
