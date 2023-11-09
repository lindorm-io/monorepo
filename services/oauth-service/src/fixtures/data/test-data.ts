import { PKCEMethod } from "@lindorm-io/common-enums";
import { encodeBase64Url } from "@lindorm-io/core";
import { randomUnreserved } from "@lindorm-io/random";
import { createHash } from "crypto";

type Result = {
  code: string;
  codeChallenge: string;
  codeChallengeMethod: PKCEMethod;
  codeVerifier: string;
  nonce: string;
  state: string;
};

export const getTestData = (): Result => {
  const code = randomUnreserved(128);
  const codeVerifier = encodeBase64Url(randomUnreserved(64)).slice(0, 43);
  const codeChallengeMethod = PKCEMethod.SHA256;
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

  const nonce = randomUnreserved(16);
  const state = randomUnreserved(16);

  return {
    code,
    codeChallenge,
    codeChallengeMethod,
    codeVerifier,
    nonce,
    state,
  };
};
