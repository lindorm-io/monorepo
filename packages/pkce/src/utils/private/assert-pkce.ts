import { PkceMethod } from "@lindorm/enums";
import { PkceError } from "../../errors";
import { verifyPkce } from "./verify-pkce";

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
