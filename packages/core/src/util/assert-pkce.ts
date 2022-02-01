import { ClientError, ServerError } from "@lindorm-io/errors";
import { PKCEMethod } from "../enum";
import { createHash } from "crypto";
import { stringComparison } from "./string-comparison";

const assertPlainPKCE = (pkceChallenge: string, pkceMethod: string, pkceVerifier: string): void => {
  if (stringComparison(pkceChallenge, pkceVerifier)) return;

  throw new ClientError("Invalid PKCE", {
    code: "invalid_pkce",
    debug: {
      pkceChallenge,
      pkceMethod,
      pkceVerifier,
    },
    description: "Invalid plain PKCE verifier",
  });
};

const assertShaPKCE = (pkceChallenge: string, pkceMethod: string, pkceVerifier: string): void => {
  const hash = createHash("sha256").update(pkceVerifier, "utf8").digest("base64");

  if (stringComparison(pkceChallenge, hash)) return;

  throw new ClientError("Invalid PKCE", {
    code: "invalid_pkce",
    debug: {
      pkceChallenge,
      pkceMethod,
      pkceVerifier,
    },
    description: "Invalid SHA PKCE verifier",
  });
};

export const assertPKCE = (
  pkceChallenge: string,
  pkceMethod: PKCEMethod,
  pkceVerifier: string,
): void => {
  switch (pkceMethod) {
    case PKCEMethod.PLAIN:
      return assertPlainPKCE(pkceChallenge, pkceMethod, pkceVerifier);

    case PKCEMethod.S256:
      return assertShaPKCE(pkceChallenge, pkceMethod, pkceVerifier);

    default:
      throw new ServerError("Invalid PKCE method");
  }
};
