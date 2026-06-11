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
  LindormClaims & {
    accessToken?: string;
    authCode?: string;
    authState?: string;
    claims?: C;
    expires: Expiry;
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
};

export type SignedJwt = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  objectId: string | undefined;
  token: string;
  tokenId: string;
};
