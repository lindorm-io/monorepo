import { ChallengeStrategy, Factor } from "../enum";
import { IssuerVerifyData } from "@lindorm-io/jwt";

export type ChallengeConfirmationTokenPayload = Record<string, unknown>;

export interface ChallengeConfirmationTokenClaims {
  deviceLinkId: string;
  factors: Array<Factor>;
  strategy: ChallengeStrategy;
}

export type VerifiedChallengeConfirmationToken = IssuerVerifyData<
  ChallengeConfirmationTokenPayload,
  ChallengeConfirmationTokenClaims
>;
