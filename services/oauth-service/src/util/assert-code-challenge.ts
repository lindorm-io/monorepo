import { ClientError } from "@lindorm-io/errors";
import { assertPKCE, PKCEMethod } from "@lindorm-io/core";

export const assertCodeChallenge = (
  codeChallenge: string,
  codeChallengeMethod: PKCEMethod,
  codeVerifier: string,
): void => {
  try {
    return assertPKCE(codeChallenge, codeChallengeMethod, codeVerifier);
  } catch (err) {
    throw new ClientError("Invalid Code", {
      code: "invalid_code",
      error: err,
    });
  }
};
