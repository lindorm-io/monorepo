import { ClientError } from "@lindorm-io/errors";
import { assertPKCE } from "@lindorm-io/node-pkce";
import { PKCEMethod } from "@lindorm-io/common-types";

export const assertCodeChallenge = (
  codeChallenge: string,
  codeChallengeMethod: PKCEMethod,
  codeVerifier: string,
): void => {
  try {
    return assertPKCE(codeChallenge, codeChallengeMethod, codeVerifier);
  } catch (err: any) {
    throw new ClientError("Invalid Code", {
      code: "invalid_code",
      error: err,
    });
  }
};
