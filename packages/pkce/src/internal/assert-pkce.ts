import type { PkceMethod } from "@lindorm/types";
import { PkceError } from "../errors/index.js";
import { verifyPkce } from "./verify-pkce.js";

export const assertPkce = (
  challenge: string,
  verifier: string,
  method: PkceMethod,
): void => {
  if (verifyPkce(challenge, verifier, method)) return;

  throw new PkceError("Invalid PKCE", {
    code: "invalid_pkce",
    debug: { challenge, method, verifier },
  });
};
