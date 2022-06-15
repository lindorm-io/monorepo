import { ChallengeStrategy, DeviceFactor } from "../enum";
import { JwtVerifyData } from "@lindorm-io/jwt";
import { IdentityServiceClaims } from "./claims";

export interface AuthenticationConfirmationTokenClaims {
  country: string;
  remember: boolean;
  verifiedIdentifiers: Array<string>;
}

export type VerifiedAuthenticationConfirmationToken = JwtVerifyData<
  never,
  AuthenticationConfirmationTokenClaims
>;

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  factors: Array<DeviceFactor>;
  strategy: ChallengeStrategy;
}

export type VerifiedChallengeConfirmationToken = JwtVerifyData<
  Record<string, any>,
  ChallengeConfirmationTokenClaims
>;

export type VerifiedIdentityToken = JwtVerifyData<never, IdentityServiceClaims>;
