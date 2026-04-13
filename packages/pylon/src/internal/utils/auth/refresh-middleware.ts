import { ms } from "@lindorm/date";
import { ClientError, ServerError } from "@lindorm/errors";
import { PylonAuthConfig, PylonHttpContext, PylonHttpMiddleware } from "../../../types";
import { parseTokenData } from "./parse-token-data";

const getAutoRefresh = (ctx: PylonHttpContext, config: PylonAuthConfig): number => {
  switch (config.refresh.mode) {
    case "force":
      return -1;

    case "half_life": {
      const issuedAt = ctx.state.session!.issuedAt.getTime();
      const expiresAt = ctx.state.session!.expiresAt?.getTime() ?? issuedAt;
      return Math.floor((issuedAt + expiresAt) / 2);
    }

    case "max_age":
      return ctx.state.session!.issuedAt.getTime() + ms(config.refresh.maxAge);

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
        try {
          const data = await ctx.auth.token({
            grantType: "refresh_token",
            refreshToken: ctx.state.session.refreshToken,
          });

          ctx.state.session = await parseTokenData(ctx.aegis, data, {
            defaultTokenExpiry: config.defaultTokenExpiry,
            session: ctx.state.session,
          });

          await ctx.session.set(ctx.state.session);
        } catch (error) {
          ctx.logger.warn("Token refresh failed, clearing session", { error });
          await ctx.session.del();
          ctx.state.session = null;
        }
      }
    }

    await next();
  };
