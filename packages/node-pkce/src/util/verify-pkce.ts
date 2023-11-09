import { LindormError } from "@lindorm-io/errors";
import { PKCEMethod } from "@lindorm-io/common-enums";
import { createBaseHash } from "./create-base-hash";
import { stringComparison } from "./string-comparison";

export const verifyPKCE = (challenge: string, method: PKCEMethod, verifier: string): boolean => {
  switch (method) {
    case PKCEMethod.PLAIN:
      return stringComparison(challenge, verifier);

    case PKCEMethod.SHA256:
      return stringComparison(challenge, createBaseHash(verifier));

    default:
      throw new LindormError("Invalid PKCE method", {
        debug: { challenge, method, verifier },
      });
  }
};
