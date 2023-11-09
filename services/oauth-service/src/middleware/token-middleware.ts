import { TokenType } from "@lindorm-io/common-enums";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";
import { configuration } from "../server/configuration";

export const idTokenMiddleware = tokenValidationMiddleware({
  contextKey: "idToken",
  issuer: configuration.server.issuer,
  types: [TokenType.ID],
});
