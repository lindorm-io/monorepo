import { createAccessTokenMiddleware } from "../../../../middleware/common/create-access-token-middleware.js";
import { SOCKET_AUTH_TEST_ISSUER } from "../../shared.js";

export const secureBranchMiddleware = async (ctx: any, next: any) => {
  ctx.state = ctx.state || {};
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("secure");
  await next();
};

export const MIDDLEWARE = [
  createAccessTokenMiddleware({ issuer: SOCKET_AUTH_TEST_ISSUER }),
  secureBranchMiddleware,
];
