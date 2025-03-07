import { expiresAt } from "@lindorm/date";
import { CookieOptions, PylonCookieConfig, PylonHttpMiddleware } from "../../types";
import {
  decodeCookieValue,
  encodeCookieValue,
  getCookieEncryptionKeys,
} from "../../utils/private";

export const createHttpCookieMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware => {
  const keys = getCookieEncryptionKeys(config);

  return async function httpCookieMiddleware(ctx, next) {
    ctx.setCookie = <T = any>(
      name: string,
      value: T,
      options: CookieOptions = {},
    ): void => {
      ctx.cookies.set(name, encodeCookieValue(value, keys, options), {
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

    ctx.getCookie = <T = any>(name: string): T | undefined => {
      const value = ctx.cookies.get(name, {
        signed: Boolean(config.signatureKeys?.length),
      });

      if (!value) return;

      return decodeCookieValue(value, keys) as T;
    };

    ctx.delCookie = (name: string): void => {
      ctx.cookies.set(name, null);
    };

    await next();
  };
};
