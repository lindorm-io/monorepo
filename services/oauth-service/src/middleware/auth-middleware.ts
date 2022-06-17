import { SubjectHint } from "../common";
import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.server.issuer,
  subjectHint: SubjectHint.CLIENT,
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  audiences: [configuration.oauth.client_id],
  issuer: configuration.server.issuer,
  subjectHint: SubjectHint.IDENTITY,
});
