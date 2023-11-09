import { SubjectHint } from "@lindorm-io/common-enums";
import { bearerAuthMiddleware } from "@lindorm-io/koa-bearer-auth";
import { configuration } from "../server/configuration";

export const clientAuthMiddleware = bearerAuthMiddleware({
  audience: configuration.oauth.client_id,
  issuer: configuration.server.issuer,
  subjectHints: [SubjectHint.CLIENT],
});

export const identityAuthMiddleware = bearerAuthMiddleware({
  audience: configuration.oauth.client_id,
  issuer: configuration.server.issuer,
  subjectHints: [SubjectHint.IDENTITY],
});
