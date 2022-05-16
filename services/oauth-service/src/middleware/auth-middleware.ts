import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.server.issuer,
  subjectHint: "client",
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.server.issuer,
  subjectHint: "identity",
});
