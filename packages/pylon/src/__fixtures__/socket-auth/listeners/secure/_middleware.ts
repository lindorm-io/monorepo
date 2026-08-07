import { useAccessToken } from "../../../../middleware/common/use-access-token.js";

export const secureBranchMiddleware = async (ctx: any, next: any) => {
  ctx.state = ctx.state || {};
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("secure");
  await next();
};

export const MIDDLEWARE = [useAccessToken(), secureBranchMiddleware];
