import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";
import { SubjectHints } from "@lindorm-io/common-types";

export const clientAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.services.oauth_service.issuer,
  subjectHint: SubjectHints.CLIENT,
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.services.oauth_service.issuer,
  subjectHint: SubjectHints.IDENTITY,
});
