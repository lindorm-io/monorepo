import { ChallengeStrategy, Dict, LindormClaims, PSD2Factor } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";

export interface AuthenticationConfirmationTokenClaims {
  country: string | null;
  maximumLoa: number;
  remember: boolean;
  sso: boolean;
  verifiedIdentifiers: Array<string>;
}

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  ext: Dict;
  factors: Array<PSD2Factor>;
  strategy: ChallengeStrategy;
}

export interface RdcSessionTokenClaims {
  ext: Dict;
}

export type VerifiedAuthenticationConfirmationToken =
  JwtDecodeData<AuthenticationConfirmationTokenClaims>;

export type VerifiedChallengeConfirmationToken = JwtDecodeData<ChallengeConfirmationTokenClaims>;

export type VerifiedRdcSessionToken = JwtDecodeData<RdcSessionTokenClaims>;

export type VerifiedIdentityToken = JwtDecodeData<LindormClaims>;
