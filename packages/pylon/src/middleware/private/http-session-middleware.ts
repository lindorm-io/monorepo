import { PylonHttpMiddleware, PylonSessionConfig } from "../../types";

export const createHttpSessionMiddleware = (
  config: PylonSessionConfig,
): PylonHttpMiddleware =>
  async function httpSessionMiddleware(ctx, next) {
    const session = await ctx.getSession();

    ctx.session = session;

    if (session?.id) {
      ctx.metadata.sessionId = session.id;
      ctx.logger.correlation({ sessionId: session.id });
    }

    if (config.verify && session?.accessToken) {
      ctx.tokens.accessToken = await ctx.aegis.verify(session.accessToken);
    }

    if (config.verify && session?.idToken) {
      ctx.tokens.idToken = await ctx.aegis.verify(session.idToken);
    }

    await next();
  };
