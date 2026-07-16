import type { AesContent } from "@lindorm/aes";
import { ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { sanitiseToken } from "@lindorm/utils";
import { PylonCookie } from "../classes/PylonCookie.js";
import type {
  PylonCookieSettings,
  PylonHttpMiddleware,
  PylonSetCookieOptions,
} from "../../types/index.js";
import { chunkCookieValue } from "../utils/cookies/chunk-cookie-value.js";
import { createGetCookie } from "../utils/cookies/create-get-cookie.js";
import { encryptCookie } from "../utils/cookies/encrypt-cookie.js";
import { parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { signCookie } from "../utils/cookies/sign-cookie.js";

const DEFAULT_CHUNK_SIZE = 4000;

export const createHttpCookiesMiddleware = (
  config: PylonCookieSettings = {},
): PylonHttpMiddleware => {
  config.encoding = config.encoding || "base64url";

  return async function httpCookiesMiddleware(ctx, next) {
    const parsed = parseCookieHeader(ctx.get("cookie"));

    const getCookie = createGetCookie({
      ctx,
      config,
      parsed,
      signature: config.signature,
      encryption: config.encryption,
    });

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
        options: PylonSetCookieOptions = {},
      ): Promise<void> => {
        const opts = { ...config, ...options };

        // CONFIGURED KEY ⇒ ON BY DEFAULT. A plain `set(name, value)` signs when
        // a cookie signing key is configured and seals when an encryption key is;
        // a per-call `signature`/`encryption` overrides that — `false` opts THIS
        // cookie out even when a key is configured, a selector names its own key.
        // Resolution below is unchanged: `true` ⇒ the deployment cookie key, a
        // selector ⇒ that key, and the throwing resolver is the fail-closed
        // contract when a role is on with no resolvable key.
        const signatureOpt = options.signature ?? config.signature !== undefined;
        const encryptionOpt = options.encryption ?? config.encryption !== undefined;

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

        if (!opts.encoding && !encryptionOpt && isObject(value)) {
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

        if (encryptionOpt) {
          // `encryptionOpt` is `boolean | selector`: `true` ⇒ the deployment
          // cookie key, a selector ⇒ THIS cookie's own key (the session
          // middleware hands us the resolved session key). `encryptCookie`
          // resolves it to a concrete key or throws — a cookie set `encryption: true`
          // with no cookie key configured is a loud failure, never a silent seal
          // with the published JWKS token key. Do NOT add an undefined-guard here:
          // the throwing resolver IS the fail-closed contract.
          const encKey = encryptionOpt === true ? config.encryption : encryptionOpt;

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

        if (signatureOpt) {
          // Same collapsed shape as `encryptionOpt`: `true` ⇒ the deployment
          // cookie signing key, a selector ⇒ this cookie's own. `signCookie`
          // throws when the resolved key is unconfigured — fail-closed, never an
          // unsigned write.
          const signKey = signatureOpt === true ? config.signature : signatureOpt;

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
