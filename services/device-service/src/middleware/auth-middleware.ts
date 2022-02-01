import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.oauth.host,
  subjectHint: "client",
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.oauth.host,
  subjectHint: "identity",
});
