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
import type { OmitMode } from "../../internal/utils/apply-omit.js";
import type { AegisSignKey } from "../keys/key-selectors.js";
import type { BindCertificateMode } from "../header/domain-header.js";
import type { WireProtectedHeader } from "../header/wire-envelope.js";

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
  bindCertificate?: BindCertificateMode;
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` whenever a
   * cert is bound. Default `true` (older-client compat).
   */
  certificateThumbprintSha1?: boolean;
  /** Caller-controlled PROTECTED wire header params (`oid` rides here, ruling 3). */
  header?: WireProtectedHeader;
  /**
   * How empty claims are pruned before signing. `"empty"` (default) drops
   * null/empty-string/empty-array/empty-object recursively; `"undefined"` drops
   * only undefined.
   */
  omit?: OmitMode;
  accessTokenHash?: string;
  codeHash?: string;
  issuedAt?: Date;
  /**
   * Per-call signing key policy. Ignored by `JwtKit`, which is handed an
   * explicit key; consumed by `Aegis`, which resolves one.
   */
  key?: AegisSignKey;
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

/**
 * The DOMAIN sugar the `aegis.cwt`/`aegis.cwm`/`aegis.cws` sign namespaces return
 * — the COSE twin of {@link SignedJwt}. `token` stays a base64url `string` (R4);
 * the wire kit's native `Buffer` is base64url-encoded so the string-token API is
 * uniform with the JOSE sign paths.
 */
export type SignedCwt = {
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  expiresOn: number | undefined;
  objectId: string | undefined;
  token: string;
  tokenId: string | undefined;
};
