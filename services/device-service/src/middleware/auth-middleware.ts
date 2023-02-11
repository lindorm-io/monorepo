import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";
import { SubjectHints } from "@lindorm-io/common-types";

export const clientAuthMiddleware = bearerAuthMiddleware({
  audience: configuration.oauth.client_id,
  issuer: configuration.services.oauth_service.issuer,
  subjectHints: [SubjectHints.CLIENT],
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  audience: configuration.oauth.client_id,
  issuer: configuration.services.oauth_service.issuer,
  subjectHints: [SubjectHints.IDENTITY],
});
