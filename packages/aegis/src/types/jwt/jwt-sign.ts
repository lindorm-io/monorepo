import type { Expiry } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
import type {
  AegisProfile,
  AegisSensitiveIdentity,
  LindormClaims,
  OAuthClaims,
  OidcClaims,
  PopClaims,
  RarClaims,
  DelegationClaims,
  SetClaims,
  StdClaims,
} from "../claims/index.js";
import type { BindCertificateMode, TokenEncryptOrSignOptions } from "../header.js";

export type SignJwtContent<C extends Dict = Dict> = Omit<
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
    claims?: C;
    expires: Expiry;
    issuer?: string;
    profile?: AegisProfile;
    sensitiveIdentity?: AegisSensitiveIdentity;
    subject: string;
    tokenType: "Bearer" | "DPoP" | "N_A" | (string & {});
  };

export type SignJwtOptions = {
  accessTokenHash?: string;
  bindCertificate?: BindCertificateMode;
  codeHash?: string;
  header?: TokenEncryptOrSignOptions;
  issuedAt?: Date;
  objectId?: string;
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

export type SignedJwt = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  objectId: string | undefined;
  token: string;
  tokenId: string | undefined;
};
