import { randomBaseString } from "./random-base-string";
import { createBaseHash } from "./create-base-hash";
import { PKCEMethod } from "@lindorm-io/common-types";

type Result = {
  challenge: string;
  verifier: string;
  method: PKCEMethod;
};

export const createPKCE = (method: PKCEMethod = PKCEMethod.SHA256, length: number = 43): Result => {
  const verifier = randomBaseString(length);
  const challenge = method === "plain" ? verifier : createBaseHash(verifier);

  return { challenge, verifier, method };
};
