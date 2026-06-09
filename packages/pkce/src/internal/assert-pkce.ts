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
    title: "Invalid PKCE",
    details:
      "The PKCE code verifier does not match the code challenge for the given method.",
    debug: { challenge, method, verifier },
  });
};
