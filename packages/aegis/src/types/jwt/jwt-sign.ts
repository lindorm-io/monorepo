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
} from "../claims/index.js";
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { AegisSignKey } from "../aegis.js";
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
    sensitive?: AegisSensitive;
    subject: string;
    tokenType: "Bearer" | "DPoP" | "N_A" | (string & {});
  };

export type SignJwtOptions = {
  accessTokenHash?: string;
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true` (older-client compat). Independent of
   * `bindCertificate`; the read side never verifies SHA-1.
   */
  certificateThumbprintSha1?: boolean;
  codeHash?: string;
  header?: TokenEncryptOrSignOptions;
  issuedAt?: Date;
  objectId?: string;
  /**
   * Per-call signing key policy. Ignored by `JwtKit`, which is handed an
   * explicit key; consumed by `Aegis`, which resolves one.
   */
  key?: AegisSignKey;
  /**
   * How empty claims are pruned before signing. `"empty"` (default) drops
   * null/empty-string/empty-array/empty-object recursively; `"undefined"` drops
   * only undefined.
   */
  omit?: OmitMode;
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
