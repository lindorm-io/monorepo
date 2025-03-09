import { expiresAt } from "@lindorm/date";
import {
  GetCookieOptions,
  PylonCookieConfig,
  PylonHttpMiddleware,
  SetCookieOptions,
} from "../../types";
import { decodeCookieValue, encodeCookieValue } from "../../utils/private";

export const createHttpCookieMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware =>
  async function httpCookieMiddleware(ctx, next) {
    ctx.setCookie = async <T = any>(
      name: string,
      value: T,
      options: SetCookieOptions = {},
    ): Promise<void> => {
      const opts: PylonCookieConfig & SetCookieOptions = {
        ...config,
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
        signed: config.signed ?? options.signed ?? false,
      });

      if (!cookie) return;

      return await decodeCookieValue<T>(ctx, cookie);
    };

    ctx.delCookie = (name: string): void => {
      ctx.cookies.set(name, null);
    };

    await next();
  };
