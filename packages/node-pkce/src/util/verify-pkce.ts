import { LindormError } from "@lindorm-io/errors";
import { PKCE } from "../types";
import { PKCEMethod } from "../enum";
import { createBaseHash } from "./create-base-hash";
import { stringComparison } from "./string-comparison";

export const verifyPKCE = (challenge: string, method: PKCE, verifier: string): boolean => {
  switch (method) {
    case PKCEMethod.PLAIN:
      return stringComparison(challenge, verifier);

    case PKCEMethod.S256:
      return stringComparison(challenge, createBaseHash(verifier));

    default:
      throw new LindormError("Invalid PKCE method", {
        debug: { challenge, method, verifier },
      });
  }
};
