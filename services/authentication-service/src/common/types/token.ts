import { ChallengeStrategy, LindormClaims, PSD2Factor } from "@lindorm-io/common-types";
import { JwtDecodeData } from "@lindorm-io/jwt";

export type AuthenticationConfirmationTokenClaims = {
  country: string | null;
  maximumLoa: number;
  remember: boolean;
  verifiedIdentifiers: Array<string>;
};

export type VerifiedAuthenticationConfirmationToken = JwtDecodeData<
  never,
  AuthenticationConfirmationTokenClaims
>;

export type ChallengeConfirmationTokenClaims = {
  deviceLinkId: string;
  factors: Array<PSD2Factor>;
  strategy: ChallengeStrategy;
};

export type VerifiedChallengeConfirmationToken = JwtDecodeData<
  Record<string, any>,
  ChallengeConfirmationTokenClaims
>;

export type VerifiedIdentityToken = JwtDecodeData<never, LindormClaims>;
