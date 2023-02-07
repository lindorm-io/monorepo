import { ChallengeStrategy, LindormClaims, PSD2Factor } from "@lindorm-io/common-types";
import { JwtVerifyData } from "@lindorm-io/jwt";

export interface AuthenticationConfirmationTokenClaims {
  country: string;
  maximumLoa: number;
  remember: boolean;
  verifiedIdentifiers: Array<string>;
}

export type VerifiedAuthenticationConfirmationToken = JwtVerifyData<
  never,
  AuthenticationConfirmationTokenClaims
>;

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  factors: Array<PSD2Factor>;
  strategy: ChallengeStrategy;
}

export type VerifiedChallengeConfirmationToken = JwtVerifyData<
  Record<string, any>,
  ChallengeConfirmationTokenClaims
>;

export type VerifiedIdentityToken = JwtVerifyData<never, LindormClaims>;
