import type { PkceMethod } from "@lindorm/types";
import { PkceError } from "../errors/index.js";
import { createBaseHash } from "./create-base-hash.js";
import { stringComparison } from "./string-comparison.js";

export const verifyPkce = (
  challenge: string,
  verifier: string,
  method: PkceMethod,
): boolean => {
  switch (method) {
    case "S256":
      return stringComparison(challenge, createBaseHash(verifier));

    case "plain":
      return stringComparison(challenge, verifier);

    default:
      throw new PkceError("Invalid PKCE method", {
        debug: { challenge, method, verifier },
      });
  }
};
