import { createHash } from "crypto";
import { randomString, PKCEMethod, encodeBase64Url } from "@lindorm-io/core";

interface Result {
  code: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
  state: string;
}

export const getTestData = (): Result => {
  const code = randomString(128);
  const codeVerifier = encodeBase64Url(randomString(64)).slice(0, 43);
  const codeChallengeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const nonce = randomString(16);
  const state = randomString(16);

  return {
    code,
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
    nonce,
    state,
  };
};
