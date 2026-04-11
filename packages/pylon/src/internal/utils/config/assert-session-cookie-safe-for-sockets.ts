import { PylonError } from "../../../errors/PylonError";
import { PylonOptions } from "../../../types";

export const assertSessionCookieSafeForSockets = (
  options: Pick<PylonOptions, "session" | "cors">,
): void => {
  if (!options.session) return;

  const allowOrigins = options.cors?.allowOrigins;

  if (!allowOrigins) {
    throw new PylonError(
      "Session middleware requires an explicit CORS allowlist for socket transport",
      {
        details:
          "Set options.cors.allowOrigins to a list of origins (not '*'). " +
          "Cookie-mode socket auth is Cross-Site WebSocket Hijacking (CSWSH) " +
          "vulnerable without server-side origin enforcement.",
        code: "missing_cors_allowlist_for_session",
      },
    );
  }

  if (allowOrigins === "*") {
    throw new PylonError(
      "Session middleware requires a non-wildcard CORS allowlist for socket transport",
      {
        details:
          "options.cors.allowOrigins cannot be '*' when options.session is set. " +
          "Cookie-mode socket auth is Cross-Site WebSocket Hijacking (CSWSH) " +
          "vulnerable without an explicit origin allowlist.",
        code: "wildcard_cors_allowlist_for_session",
      },
    );
  }
};
