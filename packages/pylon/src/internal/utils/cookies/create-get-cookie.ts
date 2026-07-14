import { AesKit } from "@lindorm/aes";
import type { Dict } from "@lindorm/types";
import { safelyParse } from "@lindorm/utils";
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

    // No selector on the read side: the ciphertext names its own key, so aegis
    // resolves it by kid. A cookie written before this deployment changed which
    // key it encrypts with still decrypts — and always will.
    if (AesKit.isAesTokenised(value)) {
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
