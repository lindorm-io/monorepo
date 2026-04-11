import { PylonError } from "../../../errors/PylonError";
import { PylonSessionOptions } from "../../../types";

const ALLOWED: ReadonlyArray<string> = ["lax", "strict"];

export const assertSameSiteForSockets = (
  sessionConfig: PylonSessionOptions | undefined,
): void => {
  if (!sessionConfig) return;

  const sameSite = sessionConfig.sameSite;

  if (sameSite === undefined || sameSite === null) {
    throw new PylonError(
      "Session cookie SameSite must be 'lax' or 'strict' when auto-wired for sockets",
      {
        details:
          "options.session.sameSite is unset. Cross-Site WebSocket Hijacking " +
          "(CSWSH) defense-in-depth requires SameSite=Lax or SameSite=Strict on " +
          "the session cookie. Set options.session.sameSite explicitly.",
        code: "missing_same_site_for_session",
      },
    );
  }

  const normalised = String(sameSite).toLowerCase();

  if (!ALLOWED.includes(normalised)) {
    throw new PylonError(
      "Session cookie SameSite must be 'lax' or 'strict' when auto-wired for sockets",
      {
        details:
          `options.session.sameSite is '${sameSite}'. Cross-Site WebSocket ` +
          "Hijacking (CSWSH) defense-in-depth requires SameSite=Lax or " +
          "SameSite=Strict on the session cookie.",
        code: "invalid_same_site_for_session",
      },
    );
  }
};
