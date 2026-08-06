import type { AegisSignKey } from "@lindorm/aegis";
import type { ReadableTime } from "@lindorm/date";
import { expires } from "@lindorm/date";
import { lindormId } from "@lindorm/random";
import type { PylonAuthDriverContext } from "../../../../types/index.js";

export type MintClientAssertionOptions = {
  /** Becomes `aud`. See the note below on why this is the token endpoint. */
  audience: string;
  clientId: string;
  expiry: ReadableTime;
  key: AegisSignKey;
};

/**
 * Mint the RFC 7523 §2.2 `client_assertion` JWT.
 *
 * The claim set is exactly what RFC 7523 §3 and OIDC Core §9 require of an
 * assertion used for CLIENT AUTHENTICATION:
 *
 * - `iss` and `sub` are BOTH the client id. RFC 7523 §3 (1) wants an issuer
 *   identifying the entity that issued the JWT and (2) a subject "identifying
 *   the principal that is the subject of the JWT"; OIDC Core §9 removes the
 *   ambiguity for this use — each "MUST contain the client_id of the OAuth
 *   Client". The client authenticates as itself, so issuer and subject coincide.
 * - `aud` is the TOKEN ENDPOINT URL, not the issuer identifier. RFC 7523 §3 (3)
 *   only requires "a value that identifies the authorization server as an
 *   intended audience" and leaves the choice open, but OIDC Core §9 narrows it
 *   for both assertion methods: "The Audience SHOULD be the URL of the
 *   Authorization Server's Token Endpoint." The token endpoint therefore
 *   satisfies BOTH documents where the issuer identifier satisfies only the
 *   looser one — and a provider that wants something else overrides
 *   `clientAssertionAudience` on the driver.
 * - `jti` is fresh per assertion. OIDC Core §9 makes it REQUIRED and has these
 *   tokens "used only once", so a reused id is a replay the provider is
 *   entitled to refuse; RFC 7523 §3 (7) is what its replay cache keys on.
 * - `exp` is the one mandatory bound (RFC 7523 §3 (4)), and `iat` rides along —
 *   OPTIONAL per §3 (6) but universally expected, and what lets a provider
 *   enforce its own maximum assertion age.
 *
 * ⚠ NO `nbf`. RFC 7523 §3 (5) makes it purely optional, and an assertion valid
 * for a minute that a provider's clock has not reached yet is rejected outright
 * — a second clock-skew failure mode bought for nothing.
 */
export const mintClientAssertion = async (
  context: PylonAuthDriverContext,
  options: MintClientAssertionOptions,
): Promise<string> => {
  const { expiresOn, fromUnix } = expires(options.expiry);

  const { token } = await context.aegis.jwt.sign(
    {
      // RFC 7519 §4.1.3 types `aud` as an array of StringOrURI, with the single
      // bare string only a MAY. The array is the general form every provider
      // must parse.
      aud: [options.audience],
      exp: expiresOn,
      iat: fromUnix,
      iss: options.clientId,
      jti: lindormId(),
      sub: options.clientId,
    },
    { key: options.key },
  );

  context.logger.debug("Client assertion minted", {
    audience: options.audience,
    clientId: options.clientId,
    expiresOn,
  });

  return token;
};
