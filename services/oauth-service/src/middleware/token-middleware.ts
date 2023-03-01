import { OpenIdTokenType } from "@lindorm-io/common-types";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.issuer,
  types: [OpenIdTokenType.ID],
});
