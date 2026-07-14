import type { PylonHttpContext } from "../../../types/index.js";
import { appendChallenge } from "./append-challenge.js";

/**
 * The automatic 401 fallback: advertise the scheme the client actually attempted.
 * Only ever called for a 401 that carries no WWW-Authenticate of its own.
 */
export const deriveChallenge = (ctx: PylonHttpContext): void => {
  const realm = ctx.state?.app?.domain;

  switch (ctx.state?.authorization?.type) {
    case "basic":
      // RFC 7617 defines no error param for Basic.
      appendChallenge(ctx, "basic", { realm });
      return;

    case "bearer":
      // RFC 6750 §3.1
      appendChallenge(ctx, "bearer", { realm, error: "invalid_token" });
      return;

    case "dpop":
      // RFC 9449 §7.1
      appendChallenge(ctx, "dpop", { realm, error: "invalid_token" });
      return;

    case "none":
    default:
      // Pylon does not invent a scheme the client never attempted. The default also
      // covers a missing state (error thrown before the state middleware ran); it must
      // stay non-throwing — this runs inside the error handler, and a throw here would
      // mask the original error.
      ctx.logger?.warn(
        "401 response without WWW-Authenticate; the endpoint should call ctx.challenge() to advertise accepted schemes",
      );
      return;
  }
};
