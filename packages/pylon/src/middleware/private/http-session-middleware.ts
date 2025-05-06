import { Aegis } from "@lindorm/aegis";
import { PylonHttpMiddleware, PylonSession, PylonSessionConfig } from "../../types";

export const createHttpSessionMiddleware = (
  config: PylonSessionConfig = {},
): PylonHttpMiddleware => {
  const sessionName = config.name ?? "pylon_session";

  return async function httpSessionMiddleware(ctx, next) {
    ctx.session = {
      set: async (session: PylonSession): Promise<void> => {
        const value = config.store ? await config.store.set(session) : session;
        await ctx.cookies.set(sessionName, value, config);
      },

      get: async (): Promise<PylonSession | null> => {
        const cookie = await ctx.cookies.get(sessionName, config);
        const value = config.store ? await config.store.get(cookie) : cookie;
        return value ?? null;
      },

      del: async (): Promise<void> => {
        if (config.store) {
          const cookie = await ctx.cookies.get(sessionName, config);
          await config.store.del(cookie);
        }
        ctx.cookies.del(sessionName);
      },

      store: config.store,
    };

    ctx.state.session = await ctx.session.get();

    if (ctx.state.session?.id) {
      ctx.state.metadata.sessionId = ctx.state.session.id;
      ctx.logger.correlation({ sessionId: ctx.state.session.id });
    }

    if (ctx.state.session?.accessToken) {
      try {
        ctx.state.tokens.accessToken = Aegis.parse(ctx.state.session.accessToken);
      } catch {
        /* ignore */
      }
    }

    if (ctx.state.session?.idToken) {
      ctx.state.tokens.idToken = Aegis.parse(ctx.state.session.idToken);
    }

    await next();
  };
};
