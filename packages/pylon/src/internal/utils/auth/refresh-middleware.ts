import { ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import { PylonAuthConfig, PylonHttpContext, PylonHttpMiddleware } from "../../../types";
import { getAuthClient } from "./get-auth-client";
import { parseTokenData } from "./parse-token-data";

const getAutoRefresh = (ctx: PylonHttpContext, config: PylonAuthConfig): number => {
  switch (config.refresh.mode) {
    case "force":
      return -1;

    case "half_life":
      return Math.floor((ctx.state.session!.issuedAt + ctx.state.session!.expiresAt) / 2);

    case "max_age":
      return ctx.state.session!.issuedAt + ms(config.refresh.maxAge);

    default:
      throw new ServerError("Invalid refresh mode");
  }
};

export const createRefreshMiddleware = <C extends PylonHttpContext>(
  config: PylonAuthConfig,
): PylonHttpMiddleware<C> =>
  async function refreshMiddleware(ctx, next) {
    if (!ctx.state.session) {
      throw new ClientError("Session not found", {
        status: ClientError.Status.Unauthorized,
      });
    }

    if (config.refresh.mode !== "none") {
      const now = Date.now();
      const autoRefresh = getAutoRefresh(ctx, config);

      if (now >= autoRefresh) {
        const client = getAuthClient(ctx, config);

        const data = await client.token({
          grantType: "refresh_token",
          refreshToken: ctx.state.session.refreshToken,
        });

        ctx.state.session = parseTokenData(ctx, config, data);

        await ctx.session.set(ctx.state.session);
      }
    }

    await next();
  };
