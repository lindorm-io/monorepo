import { createHash } from "crypto";
import { getRandomString, PKCEMethod } from "@lindorm-io/core";

interface Result {
  pkceChallenge: string;
  pkceMethod: PKCEMethod;
  pkceVerifier: string;
  nonce: string;
}

export const getTestData = (): Result => {
  const pkceVerifier = getRandomString(32);
  const pkceMethod = PKCEMethod.S256;
  const pkceChallenge = createHash("sha256").update(pkceVerifier, "utf8").digest("base64");

  const nonce = getRandomString(16);

  return {
    pkceChallenge,
    pkceMethod,
    pkceVerifier,
    nonce,
  };
};
