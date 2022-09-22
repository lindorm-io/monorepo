import { createHash } from "crypto";
import { randomString, PKCEMethod } from "@lindorm-io/core";

interface Result {
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
}

export const getTestData = (): Result => {
  const codeVerifier = randomString(32);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const nonce = randomString(16);

  return {
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
    nonce,
  };
};
