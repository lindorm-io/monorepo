import { expiresAt } from "@lindorm/date";
import { CookieOptions, PylonCookieConfig, PylonHttpMiddleware } from "../../types";
import { decodeCookieValue, encodeCookieValue } from "../../utils/private";

export const createHttpCookieMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware =>
  async function httpCookieMiddleware(ctx, next) {
    ctx.setCookie = async <T = any>(
      name: string,
      value: T,
      options: CookieOptions = {},
    ): Promise<void> => {
      const cookie = await encodeCookieValue<T>(ctx, value, options);

      ctx.cookies.set(name, cookie, {
        domain: config.domain,
        expires: options.expiry ? expiresAt(options.expiry) : undefined,
        httpOnly: options.httpOnly ?? config.httpOnly,
        overwrite: options.overwrite ?? config.overwrite,
        path: options.path,
        priority: options.priority ?? config.priority,
        sameSite: config.sameSite,
        signed: options.signed ?? Boolean(config.signatureKeys?.length),
      });
    };

    ctx.getCookie = async <T = any>(name: string): Promise<T | undefined> => {
      const cookie = ctx.cookies.get(name, {
        signed: Boolean(config.signatureKeys?.length),
      });

      if (!cookie) return;

      return await decodeCookieValue<T>(ctx, cookie);
    };

    ctx.delCookie = (name: string): void => {
      ctx.cookies.set(name, null);
    };

    await next();
  };
