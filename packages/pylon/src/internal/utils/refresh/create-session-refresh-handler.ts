import { AegisError, type IAegis, isParsedJwt } from "@lindorm/aegis";
import type { IPylonSession } from "../../../interfaces/index.js";
import type { PylonSocket } from "../../../types/index.js";
import { assertSessionStillValid } from "./assert-session-still-valid.js";

export type SessionLookup = (sessionId: string) => Promise<IPylonSession | null>;

type CreateSessionRefreshHandlerOptions = {
  aegis: IAegis;
  lookup: SessionLookup;
  sessionId: string;
  socket: PylonSocket;
};

export const createSessionRefreshHandler = ({
  aegis,
  lookup,
  sessionId,
  socket,
}: CreateSessionRefreshHandlerOptions) => {
  return async (_payload: unknown): Promise<void> => {
    const session = await lookup(sessionId);
    const now = new Date();

    assertSessionStillValid(session, now);

    socket.data.session = session;

    try {
      const verified = await aegis.verify(session.accessToken);
      if (isParsedJwt(verified)) {
        socket.data.tokens.bearer = verified;

        const auth = socket.data.pylon.auth;
        if (auth) {
          const expiresAt = verified.payload.expiresAt ?? new Date(0);
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
