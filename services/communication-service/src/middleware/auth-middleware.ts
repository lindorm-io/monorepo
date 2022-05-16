import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server";

export const clientAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.services.oauth_service.issuer || configuration.services.oauth_service.host,
  subjectHint: "client",
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  issuer: configuration.services.oauth_service.issuer || configuration.services.oauth_service.host,
  subjectHint: "identity",
});
