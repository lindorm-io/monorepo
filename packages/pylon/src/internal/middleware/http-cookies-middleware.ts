import { AesContent } from "@lindorm/aes";
import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { PylonCookie } from "../classes/PylonCookie";
import { PylonCookieConfig, PylonHttpMiddleware, PylonSetCookie } from "../../types";
import { createCookieReader } from "../utils/cookies/create-cookie-reader";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header";
import { signCookie } from "../utils/cookies/sign-cookie";

export const createHttpCookiesMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware => {
  config.encoding = config.encoding || "base64url";

  return async function httpCookiesMiddleware(ctx, next) {
    const parsed = parseCookieHeader(ctx.get("cookie"));

    const reader = createCookieReader({
      aegis: ctx.aegis,
      amphora: ctx.amphora,
      config,
      parsed,
    });

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

        if (!opts.encoding && !opts.encrypted && isObject(value)) {
          throw new ServerError("Encoding required for object value", {
            code: "invalid_cookie_value",
            debug: { name, value, opts },
          });
        }

        let final: any;

        if (opts.encrypted) {
          final = await ctx.aegis.aes.encrypt(value as AesContent, "tokenised");
        } else {
          final = isString(value) ? value : JSON.stringify(value);

          if (opts.encoding) {
            final = Buffer.from(final).toString(opts.encoding);
          }
        }

        removeExisting(name);

        cookies.push(new PylonCookie(name, final, opts));

        if (opts.signed) {
          const signature = await signCookie(ctx.amphora, final);

          cookies.push(new PylonCookie(`${name}.sig`, signature, opts));
        }
      },

      get: reader.get,

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
