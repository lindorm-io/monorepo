import { useAccessToken } from "../../../../middleware/common/use-access-token.js";
import { SOCKET_AUTH_TEST_ISSUER } from "../../shared.js";

export const secureBranchMiddleware = async (ctx: any, next: any) => {
  ctx.state = ctx.state || {};
  ctx.state.middlewareChain = ctx.state.middlewareChain || [];
  ctx.state.middlewareChain.push("secure");
  await next();
};

// The mount must name the resource server's own identifier — RFC 9068 §4 makes
// validating `aud` mandatory, and only the mount knows it. This fixture pylon
// mints the tokens it verifies, so its resource identity is its own issuer,
// which is the `aud` `mintTestAccessToken` stamps.
export const MIDDLEWARE = [
  useAccessToken({ audience: SOCKET_AUTH_TEST_ISSUER }),
  secureBranchMiddleware,
];
