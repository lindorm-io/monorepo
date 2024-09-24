import { PkceMethod } from "@lindorm/enums";
import { PkceError } from "../../errors";
import { createBaseHash } from "./create-base-hash";
import { stringComparison } from "./string-comparison";

export const verifyPkce = (
  challenge: string,
  verifier: string,
  method: PkceMethod,
): boolean => {
  switch (method) {
    case PkceMethod.Plain:
      return stringComparison(challenge, verifier);

    case PkceMethod.S256:
      return stringComparison(challenge, createBaseHash(verifier));

    default:
      throw new PkceError("Invalid PKCE method", {
        debug: { challenge, method, verifier },
      });
  }
};
