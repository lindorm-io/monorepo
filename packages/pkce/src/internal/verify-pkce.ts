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
        code: "invalid_pkce_method",
        title: "Invalid PKCE Method",
        details:
          "The PKCE code challenge method is not supported; only 'S256' and 'plain' are recognised.",
        data: { method },
        debug: { challenge, verifier },
      });
  }
};
