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
import type { TokenFormatTag } from "./verified-token.js";

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

export type SignJwtOptions = DomainTokenEnvelope<AegisSignKey> & {
  accessTokenHash?: string;
  codeHash?: string;
  issuedAt?: Date;
  stateHash?: string;
  tokenId?: string;
  /**
   * Explicit JOSE `typ` header. Used by the profiled mint path to stamp the
   * profile's mandated typ (e.g. `at+jwt`, bare `JWT`) verbatim, overriding the
   * tokenType-derived value. `null` ⇒ omit `typ` (profiles with no mandated
   * typ, e.g. userinfo/jarm).
   */
  typ?: string | null;
};

/**
 * The DOMAIN sugar every `aegis` sign/mint path returns — collapsed from the
 * former byte-identical `SignedJwt` + `SignedCwt` into ONE type (both were
 * `token: string`, so the JOSE/COSE split bought nothing). `token` is always a
 * `string` (a COSE token is base64url-encoded — mint is opinionated). The
 * `format` discriminant reports the wire the token actually is, mirroring the
 * read side's `VerifiedToken.format` (a sign-then-encrypt result reports the
 * OUTER `jwe`/`cwe`).
 */
export type SignedToken = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  format: TokenFormatTag;
  objectId: string | undefined;
  token: string;
  tokenId: string | undefined;
};
