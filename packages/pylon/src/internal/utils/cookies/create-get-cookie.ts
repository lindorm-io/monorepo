import { AesKit } from "@lindorm/aes";
import { ClientError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import { safelyParse, sanitiseToken } from "@lindorm/utils";
import type {
  PylonCommonContext,
  PylonCookieConfig,
  PylonGetCookie,
  PylonKeyRoles,
} from "../../../types/index.js";
import type { ParsedCookie } from "./parse-cookie-header.js";
import { verifyCookie } from "./verify-cookie.js";

export type CreateGetCookieOptions = {
  ctx: Pick<PylonCommonContext, "aegis" | "amphora">;
  /**
   * The deployment-wide cookie config, widened by `PylonGetCookie` because the
   * connection-session middleware reads the session cookie through THIS config
   * rather than a per-call options object — so the session's own verification
   * key has to be able to travel in it.
   */
  config: PylonCookieConfig & PylonGetCookie;
  parsed: Array<ParsedCookie>;
  /**
   * The ORDINARY-cookie key roles, already resolved (`resolveCookieKeys`) — so
   * `verification` has already inherited the cookie signing predicate where the
   * deployment named no explicit one.
   */
  cookieKeys?: PylonKeyRoles;
};

export type GetCookie = <T = any>(
  name: string,
  options?: PylonGetCookie,
) => Promise<T | null>;

export const createGetCookie = ({
  ctx,
  config,
  parsed,
  cookieKeys,
}: CreateGetCookieOptions): GetCookie => {
  const cache: Dict = {};

  return async function getCookie<T = any>(
    name: string,
    options: PylonGetCookie = {},
  ): Promise<T | null> {
    if (cache[name]) return cache[name];

    const cookie = parsed.find((c) => c.name === name);

    if (!cookie) return null;

    const opts = { ...config, ...options };

    if (opts.signed) {
      // A cookie may name its OWN verification key (the session middleware hands
      // us the resolved session keys, whose `verification` already follows the
      // session SIGNATURE) — otherwise it is the deployment's cookie key.
      await verifyCookie(
        ctx,
        name,
        cookie.value,
        cookie.signature,
        cookie.kid,
        opts.verification ?? cookieKeys?.verification,
      );
    }

    let value: any = cookie.value;

    // The DECLARED policy drives the branch, never the byte prefix. Sniffing
    // `isAesTokenised(value)` here let a client dictate the read path: an
    // attacker who planted an unsealed value under a cookie the deployment reads
    // encrypted had it served back as trusted plaintext (login hijack + open
    // redirect). Policy is the authority — the value only ever conforms to it.
    if (opts.encrypted) {
      if (!AesKit.isAesTokenised(value)) {
        throw new ClientError("Encrypted cookie is not sealed", {
          code: "cookie_not_encrypted",
          title: "Encrypted Cookie Not Sealed",
          type: "urn:lindorm:pylon:error:cookie_not_encrypted",
          status: ClientError.Status.Unauthorized,
          details:
            "The cookie is declared encrypted but its value did not arrive sealed; an unsealed value under an encrypted policy is tampering or corruption and is never trusted as plaintext.",
          data: { name },
          debug: { value: sanitiseToken(value) },
        });
      }

      // No selector on the read side: the ciphertext names its own key, so aegis
      // resolves it by kid. A cookie written before this deployment changed which
      // key it encrypts with still decrypts — and always will.
      value = await ctx.aegis.aes.decrypt(value);
    } else {
      if (opts.encoding) {
        value = Buffer.from(value, opts.encoding).toString();
      }

      value = safelyParse(value);
    }

    cache[name] = value;

    return cache[name];
  };
};
