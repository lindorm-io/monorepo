import type { AesContent } from "@lindorm/aes";
import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { sanitiseToken } from "@lindorm/utils";
import { PylonCookie } from "../classes/PylonCookie.js";
import type {
  PylonCookieConfig,
  PylonHttpMiddleware,
  PylonKeys,
  PylonSetCookie,
} from "../../types/index.js";
import { chunkCookieValue } from "../utils/cookies/chunk-cookie-value.js";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { encryptCookie } from "../utils/cookies/encrypt-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { signCookie } from "../utils/cookies/sign-cookie.js";
import { resolveCookieKeys } from "../utils/keys/resolve-cookie-keys.js";

const DEFAULT_CHUNK_SIZE = 4000;

export const createHttpCookiesMiddleware = (
  config: PylonCookieConfig = {},
  keys?: PylonKeys,
): PylonHttpMiddleware => {
  config.encoding = config.encoding || "base64url";

  // The ordinary-cookie key roles, resolved once. `verification` defaults to the
  // cookie SIGNING predicate — a read policy that rejected our own writes would
  // be no policy at all.
  const cookieKeys = resolveCookieKeys(keys);

  return async function httpCookiesMiddleware(ctx, next) {
    const parsed = parseCookieHeader(ctx.get("cookie"));

    const getCookie = createGetCookie({ ctx, config, parsed, cookieKeys });

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
            title: "Missing Cookie Value",
            type: "urn:lindorm:pylon:error:missing_cookie_value",
            details: `Cannot set cookie [ ${name} ] with an empty or undefined value`,
            data: { name },
            debug: { value: sanitiseToken(value), opts },
          });
        }

        if (!opts.encoding && !opts.encryption && isObject(value)) {
          throw new ServerError("Cookie encoding required for object value", {
            code: "cookie_encoding_required",
            title: "Cookie Encoding Required",
            type: "urn:lindorm:pylon:error:cookie_encoding_required",
            details: `Cookie [ ${name} ] has an object value but no encoding or encryption configured; set an encoding or enable encryption`,
            data: { name },
            debug: { value: sanitiseToken(value), opts },
          });
        }

        let final: any;

        if (opts.encryption) {
          // `encryption` collapses to `boolean | selector`: `true` ⇒ the
          // deployment cookie key, a selector ⇒ THIS cookie's own key (the
          // session middleware hands us the resolved session key). `encryptCookie`
          // resolves it to a concrete key or throws — a cookie set `encryption: true`
          // with no cookie key configured is a loud failure, never a silent seal
          // with the published JWKS token key. Do NOT add an undefined-guard here:
          // the throwing resolver IS the fail-closed contract.
          const encKey =
            opts.encryption === true ? cookieKeys.encryption : opts.encryption;

          final = await encryptCookie(ctx, value as AesContent, encKey);
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

        if (opts.signature) {
          // Same collapsed shape as `encryption`: `true` ⇒ the deployment cookie
          // signing key, a selector ⇒ this cookie's own. `signCookie` throws when
          // the resolved key is unconfigured — fail-closed, never an unsigned write.
          const signKey = opts.signature === true ? cookieKeys.signature : opts.signature;

          const { signature, kid } = await signCookie(ctx, final, signKey);

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
