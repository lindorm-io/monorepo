import { ChallengeStrategy, DeviceFactor } from "../enum";
import { JwtVerifyData } from "@lindorm-io/jwt";

export interface AuthenticationConfirmationTokenClaims {
  country: string;
  remember: boolean;
}

export type VerifiedAuthenticationConfirmationToken = JwtVerifyData<
  never,
  AuthenticationConfirmationTokenClaims
>;

export type ChallengeConfirmationTokenPayload = Record<string, unknown>;

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  factors: Array<DeviceFactor>;
  strategy: ChallengeStrategy;
}

export type VerifiedChallengeConfirmationToken = JwtVerifyData<
  ChallengeConfirmationTokenPayload,
  ChallengeConfirmationTokenClaims
>;
