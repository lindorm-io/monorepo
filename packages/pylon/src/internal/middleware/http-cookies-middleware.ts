import type { AesContent } from "@lindorm/aes";
import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { PylonCookie } from "../classes/PylonCookie.js";
import type {
  PylonCookieConfig,
  PylonHttpMiddleware,
  PylonSetCookie,
} from "../../types/index.js";
import { chunkCookieValue } from "../utils/cookies/chunk-cookie-value.js";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { signCookie } from "../utils/cookies/sign-cookie.js";

const DEFAULT_CHUNK_SIZE = 4000;

export const createHttpCookiesMiddleware = (
  config: PylonCookieConfig = {},
): PylonHttpMiddleware => {
  config.encoding = config.encoding || "base64url";

  return async function httpCookiesMiddleware(ctx, next) {
    const parsed = parseCookieHeader(ctx.get("cookie"));

    const getCookie = createGetCookie({ ctx, config, parsed });

    let cookies: Array<PylonCookie> = [];

    const isChunkOf = (cookieName: string, baseName: string): boolean => {
      if (!cookieName.startsWith(`${baseName}.`)) return false;
      const suffix = cookieName.slice(baseName.length + 1);
      return /^\d+$/.test(suffix);
    };

    const removeExisting = (name: string): void => {
      cookies = cookies.filter(
        (cookie) =>
          cookie.name !== name &&
          cookie.name !== `${name}.sig` &&
          cookie.name !== `${name}.kid` &&
          !isChunkOf(cookie.name, name),
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
          throw new ServerError("Cookie value is required", {
            code: "missing_cookie_value",
            type: "urn:lindorm:pylon:error:missing_cookie_value",
            details: `Cannot set cookie [ ${name} ] with an empty or undefined value`,
            data: { name },
            debug: { name, value, opts },
          });
        }

        if (!opts.encoding && !opts.encrypted && isObject(value)) {
          throw new ServerError("Cookie encoding required for object value", {
            code: "cookie_encoding_required",
            type: "urn:lindorm:pylon:error:cookie_encoding_required",
            details: `Cookie [ ${name} ] has an object value but no encoding or encryption configured; set an encoding or enable encryption`,
            data: { name },
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

        const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;

        const chunks =
          opts.chunked === false
            ? [{ name, value: final as string }]
            : chunkCookieValue({ name, value: final, options: opts, chunkSize });

        for (const chunk of chunks) {
          cookies.push(new PylonCookie(chunk.name, chunk.value, opts));
        }

        const incoming = parsed.find((c) => c.name === name);
        if (incoming?.chunkIndices) {
          for (const index of incoming.chunkIndices) {
            if (index >= chunks.length) {
              cookies.push(
                new PylonCookie(`${name}.${index}`, null, { expiry: new Date(0) }),
              );
            }
          }
        }

        if (opts.signed) {
          const { signature, kid } = await signCookie(ctx, final);

          cookies.push(new PylonCookie(`${name}.sig`, signature, opts));
          cookies.push(new PylonCookie(`${name}.kid`, kid, opts));
        }
      },

      get: getCookie,

      del: (name: string): void => {
        removeExisting(name);

        cookies.push(new PylonCookie(name, null, { expiry: new Date(0) }));

        const incoming = parsed.find((c) => c.name === name);

        if (incoming) {
          if (incoming.chunkIndices) {
            for (const index of incoming.chunkIndices) {
              cookies.push(
                new PylonCookie(`${name}.${index}`, null, { expiry: new Date(0) }),
              );
            }
          }
          if (incoming.signature !== null) {
            cookies.push(new PylonCookie(`${name}.sig`, null, { expiry: new Date(0) }));
          }
          if (incoming.kid !== null) {
            cookies.push(new PylonCookie(`${name}.kid`, null, { expiry: new Date(0) }));
          }
        }
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
