import { ClientError } from "@lindorm-io/errors";
import { JwtVerify } from "@lindorm-io/jwt";
import { ChallengeConfirmationTokenClaims } from "../common";

export const assertConfirmationTokenFactorLength = (
  challengeConfirmationToken: JwtVerify<ChallengeConfirmationTokenClaims>,
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
