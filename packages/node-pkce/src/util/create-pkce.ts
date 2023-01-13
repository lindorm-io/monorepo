import { PKCE } from "../types";
import { randomBaseString } from "./random-base-string";
import { createBaseHash } from "./create-base-hash";

type Result = {
  challenge: string;
  verifier: string;
  method: PKCE;
};

export const createPKCE = (method: PKCE = "S256", length: number = 43): Result => {
  const verifier = randomBaseString(length);
  const challenge = method === "plain" ? verifier : createBaseHash(verifier);

  return { challenge, verifier, method };
};
