import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
import { PylonCookie } from "../../classes/private/PylonCookie";
import {
  PylonCookieConfig,
  PylonGetCookie,
  PylonHttpMiddleware,
  PylonSetCookie,
} from "../../types";
import { parseCookieHeader, signCookie, verifyCookie } from "../../utils/private";

export const createHttpCookiesMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware => {
  config.encoding = config.encoding || "base64url";

  return async function httpCookiesMiddleware(ctx, next) {
    const cache: Dict<any> = {};
    const parsed = parseCookieHeader(ctx.get("cookie"));

    let cookies: Array<PylonCookie> = [];

    const removeExisting = (name: string): void => {
      cookies = cookies.filter(
        (cookie) => cookie.name !== name && cookie.name !== `${name}.sig`,
      );
    };

    ctx.cookies = {
      set: async <T = any>(
        name: string,
        value: T,
        options: PylonSetCookie = {},
      ): Promise<void> => {
        const opts = { ...config, ...options };

        if (!value) {
          throw new ServerError("Cookie value is not set", {
            code: "invalid_cookie_value",
            debug: { name, value, opts },
          });
        }

        if (opts.encrypted && !opts.encoding) {
          opts.encoding = "base64url";
        }

        if (!opts.encoding && isObject(value)) {
          throw new ServerError("Encoding required for object value", {
            code: "invalid_cookie_value",
            debug: { name, value, opts },
          });
        }

        let final: any = value;

        if (opts.encrypted) {
          final = await ctx.aegis.aes.encrypt(final, "serialised");
        }

        final = isString(final) ? final : JSON.stringify(final);

        if (opts.encoding) {
          final = Buffer.from(final).toString(opts.encoding);
        }

        removeExisting(name);

        cookies.push(new PylonCookie(name, final, opts));

        if (opts.signed) {
          const signature = await signCookie(ctx, final);

          cookies.push(new PylonCookie(`${name}.sig`, signature, opts));
        }
      },

      get: async <T = any>(
        name: string,
        options: PylonGetCookie = {},
      ): Promise<T | null> => {
        if (cache[name]) return cache[name];

        const cookie = parsed.find((cookie) => cookie.name === name);

        if (!cookie) return null;

        const opts = { ...config, ...options };

        if (opts.encrypted && !opts.encoding) {
          opts.encoding = "base64url";
        }

        if (opts.signed) {
          await verifyCookie(ctx, name, cookie.value, cookie.signature);
        }

        if (opts.encoding) {
          cookie.value = Buffer.from(cookie.value, opts.encoding).toString();
        }

        cookie.value = safelyParse(cookie.value);

        if (opts.encrypted) {
          cookie.value = await ctx.aegis.aes.decrypt(cookie.value);
        }

        cache[name] = cookie.value;

        return cache[name];
      },

      del: (name: string): void => {
        removeExisting(name);

        cookies.push(new PylonCookie(name, null, { expiry: new Date(0) }));
      },
    };

    await next();

    if (cookies.length) {
      ctx.set(
        "set-cookie",
        cookies.map((cookie) => cookie.toHeader()),
      );
    }
  };
};
