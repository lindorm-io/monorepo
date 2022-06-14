import { createHash } from "crypto";
import { getRandomString, PKCEMethod } from "@lindorm-io/core";

interface Result {
  codeChallenge: string;
  codeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
}

export const getTestData = (): Result => {
  const codeVerifier = getRandomString(32);
  const codeMethod = PKCEMethod.S256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64");

  const nonce = getRandomString(16);

  return {
    codeChallenge,
    codeMethod,
    codeVerifier,
    nonce,
  };
};
