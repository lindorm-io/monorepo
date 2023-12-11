import { Middleware, axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import { ServerKoaContext } from "../../types";
import { generateServerCredentialsJwt } from "./generate-server-credentials-jwt";

export const generateServerBearerAuthMiddleware = (
  ctx: ServerKoaContext,
  audiences: Array<string> = [],
  scopes: Array<string> = [],
): Middleware => axiosBearerAuthMiddleware(generateServerCredentialsJwt(ctx, audiences, scopes));
