import { createHash } from "crypto";
import { randomString } from "@lindorm-io/random";
import { PKCEMethod } from "@lindorm-io/common-types";

interface Result {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
}

export const getTestData = (): Result => {
  const codeVerifier = randomString(32);
  const codeChallengeMethod = PKCEMethod.SHA256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const nonce = randomString(16);

  return {
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
    nonce,
  };
};
