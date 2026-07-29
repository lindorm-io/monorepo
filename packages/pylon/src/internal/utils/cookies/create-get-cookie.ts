import { AesKit } from "@lindorm/aes";
import { ClientError } from "@lindorm/errors";
import type { Dict } from "@lindorm/types";
import { safelyParse, sanitiseToken } from "@lindorm/utils";
import type {
  PylonCommonContext,
  PylonEncKey,
  PylonGetCookieOptions,
  PylonSignKey,
} from "../../../types/index.js";
import { resolveVerificationKey } from "../keys/resolve-verification-key.js";
import type { ParsedCookie } from "./parse-cookie-header.js";
import { verifyCookie } from "./verify-cookie.js";

export type CreateGetCookieOptions = {
  ctx: Pick<PylonCommonContext, "aegis" | "amphora">;
  /**
   * The deployment cookie READ defaults — `encoding`, plus the `signed`/
   * `encrypted` policy the connection-session middleware travels in because it
   * reads the session cookie through THIS config rather than a per-call options
   * object.
   */
  config: PylonGetCookieOptions;
  parsed: Array<ParsedCookie>;
  /**
   * The ORDINARY-cookie signing selector. A configured signature turns
   * verification ON by default, and its condition IS the verification policy
   * (see `resolveVerificationKey`).
   */
  signature?: PylonSignKey;
  /** The ORDINARY-cookie encryption selector — a configured key turns decrypt ON by default. */
  encryption?: PylonEncKey;
};

export type GetCookie = <T = any>(
  name: string,
  options?: PylonGetCookieOptions,
) => Promise<T | null>;

export const createGetCookie = ({
  ctx,
  config,
  parsed,
  signature,
  encryption,
}: CreateGetCookieOptions): GetCookie => {
  const cache: Dict = {};

  return async function getCookie<T = any>(
    name: string,
    options: PylonGetCookieOptions = {},
  ): Promise<T | null> {
    const cookie = parsed.find((c) => c.name === name);

    if (!cookie) return null;

    const opts = { ...config, ...options };

    const hasSignature = cookie.signature !== null && cookie.kid !== null;

    // CONFIGURED KEY ⇒ ON BY DEFAULT. A read repeats no option: a cookie set
    // under a configured signing / encryption key is verified / decrypted on
    // read because that key is named, not because `get` asked. An explicit
    // `false` opts THIS read out; a selector names a different key; absent ⇒ the
    // deployment default (on iff the matching cookie key is configured).
    const signed = opts.signed ?? signature !== undefined;
    const encrypted = opts.encrypted ?? encryption !== undefined;

    // REQUIRE-WHEN-ASKED — a per-call demand, so it runs on EVERY call, ahead of
    // any cache return. A read that declares a verification policy over a cookie
    // that carries no signature is a policy violation, not a silent pass: the
    // caller asked for a verified value and there is nothing to verify.
    if (signed && !hasSignature) {
      throw new ClientError("Cookie signature is required", {
        code: "cookie_signature_required",
        title: "Cookie Signature Required",
        details:
          "The cookie was read under a verification policy but carries no signature; an unsigned value can never satisfy a verification requirement and is never trusted.",
        type: "urn:lindorm:pylon:error:cookie_signature_required",
        status: ClientError.Status.Unauthorized,
        data: { name },
      });
    }

    // Cache is keyed on the VALUE-AFFECTING policy (encryption + encoding), NOT
    // on `name` alone. A name-only cache laundered decryption/decoding: a bare
    // read cached the undecrypted/undecoded value and a later `{ encrypted: true }`
    // read served it back without the seal-check + decrypt. Distinct policies now
    // occupy distinct slots, so decryption can never be skipped by a prior read.
    //
    // Verification is DELIBERATELY not in the key: a present signature is always
    // verified below regardless of the option, so no slot can hold a
    // pre-verification value, and the require-check above runs per-call anyway.
    //
    // Known minor limitation (accepted, not worked around): two reads of the same
    // cookie with two DIFFERENT verification SELECTORS in one request share a
    // value-policy slot, so the second reuses the first's already-verified value
    // without re-applying the second selector's condition. Verification does not
    // transform the value and the require-check still runs per-call, so this is
    // acceptable.
    const cacheKey = `${name}::enc=${encrypted ? 1 : 0}::codec=${opts.encoding ?? ""}`;

    if (cacheKey in cache) return cache[cacheKey];

    // AUTO-VERIFY a present signature REGARDLESS of the option — an unverified
    // signature is never trusted. Even a bare `get(name)` verifies a signed
    // cookie; `signed: false`/absent no longer suppresses this (it only
    // stops the require-throw above). The key: a selector picks THIS cookie's own
    // (the session middleware hands us the resolved session key, whose
    // `verification` already follows the session SIGNATURE); `true`/absent ⇒ the
    // deployment cookie verification key.
    if (hasSignature) {
      const verifyKey =
        signed && signed !== true ? signed : resolveVerificationKey(signature);

      await verifyCookie(
        ctx,
        name,
        cookie.value,
        cookie.signature,
        cookie.kid,
        verifyKey,
      );
    }

    let value: any = cookie.value;

    // The DECLARED policy drives the branch, never the byte prefix. Sniffing
    // `isAesString(value)` here let a client dictate the read path: an
    // attacker who planted an unsealed value under a cookie the deployment reads
    // encrypted had it served back as trusted plaintext (login hijack + open
    // redirect). Policy is the authority — the value only ever conforms to it.
    if (encrypted) {
      if (!AesKit.isAesString(value)) {
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

    // Populate AFTER every check — the slot never holds a pre-verification or
    // pre-decryption value.
    cache[cacheKey] = value;

    return value;
  };
};
