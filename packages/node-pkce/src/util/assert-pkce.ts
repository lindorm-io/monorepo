import { PKCEMethod } from "@lindorm-io/common-enums";
import { LindormError } from "@lindorm-io/errors";
import { verifyPKCE } from "./verify-pkce";

export const assertPKCE = (challenge: string, method: PKCEMethod, verifier: string): void => {
  if (verifyPKCE(challenge, method, verifier)) return;

  throw new LindormError("Invalid PKCE", {
    code: "invalid_pkce",
    debug: { challenge, method, verifier },
    description: `Invalid PKCE verifier [ ${method} ]`,
  });
};
