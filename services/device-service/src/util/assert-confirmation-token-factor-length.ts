import { ClientError } from "@lindorm-io/errors";
import { VerifiedChallengeConfirmationToken } from "../common";

export const assertConfirmationTokenFactorLength = (
  challengeConfirmationToken: VerifiedChallengeConfirmationToken,
  minimumFactorLength: number,
): void => {
  if (challengeConfirmationToken.claims.factors.length >= minimumFactorLength) {
    return;
  }

  throw new ClientError("Invalid factors", {
    description: "Challenge confirmed with insufficient amount of factors",
    data: { expect: minimumFactorLength },
  });
};
