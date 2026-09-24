import { AegisError, type IAegis, isStructuredToken } from "@lindorm/aegis";
import type { IPylonSession } from "../../../interfaces/index.js";
import type { PylonSocket } from "../../../types/index.js";
import { sessionResolvedAccess } from "../tokens/session-resolved-access.js";
import { assertSessionStillValid } from "./assert-session-still-valid.js";

/**
 * Takes NOTHING. Reading a stored session needs the holder's secret as well as its
 * id, and the socket refresh path has no cookie in hand — so the whole handle is
 * captured in the closure the caller hands over, rather than a bare id being passed
 * back in. The `sessionId` option went with it: it existed ONLY to be handed back to
 * `lookup`, and the refreshed session carries its own id onto `socket.data.session`.
 */
export type SessionLookup = () => Promise<IPylonSession | null>;

type CreateSessionRefreshHandlerOptions = {
  aegis: IAegis;
  critical: Array<string> | undefined;
  lookup: SessionLookup;
  socket: PylonSocket;
};

export const createSessionRefreshHandler = ({
  aegis,
  critical,
  lookup,
  socket,
}: CreateSessionRefreshHandlerOptions) => {
  return async (_payload: unknown): Promise<void> => {
    const session = await lookup();
    const now = new Date();

    assertSessionStillValid(session, now);

    socket.data.session = session;

    try {
      const verified = await aegis.verify(session.accessToken, undefined, { critical });
      // Domain-keyed claims, so a rotated CWT re-arms the socket's expiry the
      // same way a JWT does — under the old gate it silently did not.
      if (isStructuredToken(verified)) {
        socket.data.tokens.bearer = verified;
        // Republished alongside the parsed token, or the socket fast path would
        // keep serving the claims of the token this refresh replaced.
        socket.data.pylon.access = sessionResolvedAccess(session.accessToken, verified);

        const auth = socket.data.pylon.auth;
        if (auth) {
          const expiresAt = verified.claims.expiresAt ?? new Date(0);
          auth.getExpiresAt = () => expiresAt;
          auth.authExpiredEmittedAt = null;
        }
      }
    } catch (err) {
      if (!(err instanceof AegisError)) throw err;
      // Token unreadable — session is still updated, fall back to session.expiresAt
      const auth = socket.data.pylon.auth;
      if (auth) {
        const expiresAt = session.expiresAt ?? new Date(0);
        auth.getExpiresAt = () => expiresAt;
        auth.authExpiredEmittedAt = null;
      }
    }
  };
};
