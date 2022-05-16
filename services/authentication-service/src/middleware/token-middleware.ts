import { TokenType } from "../enum";
import { configuration } from "../server/configuration";
import { tokenValidationMiddleware } from "@lindorm-io/koa-jwt";

export const flowTokenMiddleware = tokenValidationMiddleware({
  contextKey: "flowToken",
  issuer: configuration.server.issuer,
  types: [TokenType.FLOW_SESSION],
});
