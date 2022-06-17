import { SubjectHint } from "../common";
import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.services.oauth_service.issuer,
  subjectHint: SubjectHint.CLIENT,
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.services.oauth_service.issuer,
  subjectHint: SubjectHint.IDENTITY,
});
