import { PkceMethod } from "@lindorm/types";
import { PkceError } from "../../errors";
import { createBaseHash } from "./create-base-hash";
import { stringComparison } from "./string-comparison";

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
