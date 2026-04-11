import { Aegis, ParsedJwt } from "@lindorm/aegis";
import { IPylonSession } from "../../../interfaces";
import { PylonSocket } from "../../../types";
import { assertSessionStillValid } from "./assert-session-still-valid";

export type SessionLookup = (sessionId: string) => Promise<IPylonSession | null>;

type CreateSessionRefreshHandlerOptions = {
  lookup: SessionLookup;
  sessionId: string;
  socket: PylonSocket;
};

export const createSessionRefreshHandler = ({
  lookup,
  sessionId,
  socket,
}: CreateSessionRefreshHandlerOptions) => {
  return async (_payload: unknown): Promise<void> => {
    const session = await lookup(sessionId);
    const now = new Date();

    assertSessionStillValid(session, now);

    const parsed = Aegis.parse<ParsedJwt>(session.accessToken);
    socket.data.session = session;
    socket.data.tokens.bearer = parsed;

    const auth = socket.data.pylon.auth;
    if (auth) {
      const expiresAt = parsed.payload.expiresAt ?? new Date(0);
      auth.getExpiresAt = () => expiresAt;
      auth.authExpiredEmittedAt = null;
    }
  };
};
