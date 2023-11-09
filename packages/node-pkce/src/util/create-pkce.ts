import { PKCEMethod } from "@lindorm-io/common-enums";
import { createBaseHash } from "./create-base-hash";
import { randomBaseString } from "./random-base-string";

type Result = {
  challenge: string;
  verifier: string;
  method: PKCEMethod;
};

export const createPKCE = (method: PKCEMethod = PKCEMethod.SHA256, length = 43): Result => {
  const verifier = randomBaseString(length);
  const challenge = method === "plain" ? verifier : createBaseHash(verifier);

  return { challenge, verifier, method };
};
