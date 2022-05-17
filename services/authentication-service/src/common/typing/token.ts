import { ChallengeStrategy, DeviceFactor } from "../enum";
import { IssuerVerifyData } from "@lindorm-io/jwt";

export type ChallengeConfirmationTokenPayload = Record<string, unknown>;

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  factors: Array<DeviceFactor>;
  strategy: ChallengeStrategy;
}

export type VerifiedChallengeConfirmationToken = IssuerVerifyData<
  ChallengeConfirmationTokenPayload,
  ChallengeConfirmationTokenClaims
>;
