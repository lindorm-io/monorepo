import { createHash } from "crypto";
import { getRandomString, PKCEMethod } from "@lindorm-io/core";

interface Result {
  code: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
  state: string;
}

export const getTestData = (): Result => {
  const code = getRandomString(128);
  const codeVerifier = getRandomString(32);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64");

  const nonce = getRandomString(16);
  const state = getRandomString(16);

  return {
    code,
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
    nonce,
    state,
  };
};
