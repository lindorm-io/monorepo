import { PylonHttpMiddleware, PylonSession, PylonSessionConfig } from "../../types";

export const createHttpFunctionsMiddleware = (
  sessionConfig: PylonSessionConfig = {},
): PylonHttpMiddleware => {
  const sessionName = sessionConfig.name ?? "pylon_session";

  return async function httpFunctionsMiddleware(ctx, next) {
    ctx.sessions = {
      set: async (session: PylonSession): Promise<void> => {
        const value = sessionConfig.store
          ? await sessionConfig.store.set(session)
          : session;

        await ctx.cookies.set(sessionName, value, sessionConfig);
      },

      get: async (): Promise<PylonSession | null> => {
        const cookie = await ctx.cookies.get(sessionName, sessionConfig);

        const value = sessionConfig.store
          ? await sessionConfig.store.get(cookie)
          : cookie;

        return value ?? null;
      },

      del: async (): Promise<void> => {
        if (sessionConfig.store) {
          const cookie = await ctx.cookies.get(sessionName, sessionConfig);

          await sessionConfig.store.del(cookie);
        }

        ctx.cookies.del(sessionName);
      },
    };

    await next();
  };
};
