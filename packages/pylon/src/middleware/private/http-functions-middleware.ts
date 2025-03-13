import { expiresAt } from "@lindorm/date";
import {
  GetCookieOptions,
  PylonCookieConfig,
  PylonHttpMiddleware,
  PylonSession,
  PylonSessionConfig,
  SetCookieOptions,
} from "../../types";
import { decodeCookieValue, encodeCookieValue } from "../../utils/private";

export const createHttpFunctionsMiddleware = (
  cookieConfig: PylonCookieConfig = {},
  sessionConfig: PylonSessionConfig = {},
): PylonHttpMiddleware => {
  const sessionName = sessionConfig.name ?? "pylon_session";

  return async function httpFunctionsMiddleware(ctx, next) {
    ctx.setCookie = async <T = any>(
      name: string,
      value: T,
      options: SetCookieOptions = {},
    ): Promise<void> => {
      const opts: PylonCookieConfig & SetCookieOptions = {
        ...cookieConfig,
        ...options,
      };

      const cookie = await encodeCookieValue<T>(ctx, value, opts);

      ctx.cookies.set(name, cookie, {
        domain: opts.domain,
        expires: opts.expiry ? expiresAt(opts.expiry) : undefined,
        httpOnly: opts.httpOnly ?? false,
        overwrite: opts.overwrite ?? false,
        path: opts.path,
        priority: opts.priority,
        sameSite: opts.sameSite ?? false,
        signed: opts.signed ?? false,
      });
    };

    ctx.getCookie = async <T = any>(
      name: string,
      options: GetCookieOptions = {},
    ): Promise<T | undefined> => {
      const cookie = ctx.cookies.get(name, {
        signed: cookieConfig.signed ?? options.signed ?? false,
      });

      if (!cookie) return;

      return await decodeCookieValue<T>(ctx, cookie);
    };

    ctx.delCookie = (name: string): void => {
      ctx.cookies.set(name, null);
    };

    ctx.setSession = async (session: PylonSession): Promise<void> => {
      const value = sessionConfig.store
        ? await sessionConfig.store.setSession(session)
        : session;

      await ctx.setCookie(sessionName, value, {
        ...sessionConfig,
        overwrite: true,
        priority: "high",
      });
    };

    ctx.getSession = async (): Promise<PylonSession | null> => {
      const cookie = await ctx.getCookie(sessionName, sessionConfig);

      const value = sessionConfig.store
        ? await sessionConfig.store.getSession(cookie)
        : cookie;

      return value ?? null;
    };

    ctx.delSession = async (): Promise<void> => {
      if (sessionConfig.store) {
        const cookie = await ctx.getCookie(sessionName, sessionConfig);

        await sessionConfig.store.delSession(cookie);
      }

      ctx.delCookie(sessionName);
    };

    await next();
  };
};
