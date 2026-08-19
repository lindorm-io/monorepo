import type { Expiry } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
import type {
  AegisProfile,
  AegisSensitive,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  RarClaims,
  DelegationClaims,
  SetClaims,
  StdClaims,
} from "../claims/domain/index.js";
import type { AegisSignKey } from "../keys/key-selectors.js";
import type { DomainTokenEnvelope } from "./domain-envelope.js";
import type { EncryptedToken } from "./encrypted-token.js";
import type { TokenFormat } from "./token-format.js";

export type SignJwtContent = Omit<
  StdClaims,
  "expiresAt" | "issuedAt" | "issuer" | "tokenId"
> &
  Omit<OidcClaims, "accessTokenHash" | "codeHash" | "stateHash"> &
  PopClaims &
  DelegationClaims &
  OAuthClaims &
  RarClaims &
  SetClaims &
  LindormClaims & {
    accessToken?: string;
    authCode?: string;
    authState?: string;
    claims?: Dict;
    expires: Expiry;
    issuer?: string;
    profile?: AegisProfile;
    sensitive?: AegisSensitive;
    subject: string;
    tokenType: "Bearer" | "DPoP" | "N_A" | (string & {});
  };

/**
 * The mint-time sign envelope — the caller's half of `aegis.mint`'s signing
 * options, on EITHER wire.
 *
 * ⚠ It was `SignJwtOptions`, and the name was load-bearing in the wrong
 * direction: the profiled COSE mint took the same object, so a type named for one
 * encoding was already describing both, and the `typ` field below reads as a JOSE
 * header when it is really the profile's token-type policy however it is spelled.
 */
export type SignTokenOptions = DomainTokenEnvelope<AegisSignKey> & {
  accessTokenHash?: string;
  codeHash?: string;
  issuedAt?: Date;
  stateHash?: string;
  tokenId?: string;
  /**
   * Explicit token type header — the JOSE `typ`, or the COSE `typ` (label 16)
   * translated to the CWT media type. Used by the profiled mint path to stamp the
   * profile's mandated type (e.g. `at+jwt` / `application/at+cwt`, bare `JWT` /
   * `application/cwt`) verbatim, overriding the tokenType-derived value. `null` ⇒
   * omit it (profiles with no mandated type, e.g. userinfo/jarm).
   */
  typ?: string | null;
};

/**
 * The DOMAIN sugar every `aegis` sign/mint path returns — collapsed from the
 * former byte-identical `SignedJwt` + `SignedCwt` into ONE type (both were
 * `token: string`, so the JOSE/COSE split bought nothing). `token` is always a
 * `string` (a COSE token is base64url-encoded — mint is opinionated). The
 * `format` discriminant reports the token's OWN kind, mirroring the read side's
 * `VerifiedToken.format`; an envelope around it is reported under
 * {@link SignedToken.wrapper}.
 */
export type SignedToken = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  /**
   * The token's OWN kind. A sign-then-encrypt reports the SIGNED token's format
   * here, not the envelope's — see {@link SignedToken.wrapper}.
   *
   * ⚠ {@link TokenFormat}, which EXCLUDES the encrypting outers, exactly as the
   * read side's `VerifiedToken.format` does. `buildSignedToken` is only ever
   * handed a signed format, and since the sign-then-encrypt composition stopped
   * overwriting this field there is nothing left that could put `jwe`/`cwe` here
   * — an exhaustive switch over it would otherwise still need two dead arms.
   */
  format: TokenFormat;
  /**
   * The envelope enclosing this token, when one does — set only by a
   * sign-then-encrypt (`mint(…, { encrypt })`).
   *
   * ⚠ ITS PRESENCE IS THE DISCRIMINATOR, not the value of `format`. `"jwe"`
   * appears in two different shapes: `{ format: "jwt", wrapper: "jwe" }` is a
   * signed token in an envelope, and `{ format: "jwe" }` from `aegis.encrypt` is
   * a bare encrypted token whose own kind IS `jwe`. Reading `format` alone
   * cannot tell them apart.
   */
  wrapper?: EncryptedToken["format"];
  objectId: string | undefined;
  token: string;
  tokenId: string | undefined;
};
