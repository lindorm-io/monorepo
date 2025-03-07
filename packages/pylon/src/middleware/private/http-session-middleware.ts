import { isEqual, isObject } from "@lindorm/is";
import { PylonHttpMiddleware, PylonSession, PylonSessionConfig } from "../../types";

export const createHttpSessionMiddleware = (
  config: PylonSessionConfig = {},
): PylonHttpMiddleware => {
  const name = config.name || "pylon_session";

  return async function httpSessionMiddleware(ctx, next) {
    const session = ctx.getCookie<PylonSession>(name) ?? null;

    ctx.session = session;

    if (ctx.session) {
      ctx.metadata.sessionId = ctx.session.id;
      ctx.logger.correlation({ sessionId: ctx.session.id });
    }

    await next();

    const shouldSetNew = !session && isObject(ctx.session);
    const shouldSetExisting =
      session && isObject(ctx.session) && !isEqual(session, ctx.session);
    const shouldDelete = session && ctx.session === null;

    if (shouldSetNew || shouldSetExisting) {
      ctx.setCookie(name, ctx.session, {
        encrypted: true,
        expiry: config.expiry,
        httpOnly: config.httpOnly,
        overwrite: true,
        priority: "high",
        sameSite: config.sameSite,
        signed: true,
      });
    } else if (shouldDelete) {
      ctx.delCookie(name);
    }
  };
};
