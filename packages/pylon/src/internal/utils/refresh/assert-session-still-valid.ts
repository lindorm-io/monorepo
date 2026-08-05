import { isExpired } from "@lindorm/date";
import { ClientError } from "@lindorm/errors";
import type { IPylonSession } from "../../../interfaces/index.js";

export function assertSessionStillValid(
  session: IPylonSession | null | undefined,
  now: Date,
): asserts session is IPylonSession {
  if (!session) {
    throw new ClientError("Session invalidated", {
      code: "session_invalidated",
      title: "Session Invalidated",
      type: "urn:lindorm:pylon:error:session_invalidated",
      details: "The session is no longer present in the store",
      status: ClientError.Status.Unauthorized,
    });
  }

  if (session.expiresAt && isExpired(session.expiresAt, now)) {
    throw new ClientError("Session expired", {
      code: "session_expired",
      title: "Session Expired",
      type: "urn:lindorm:pylon:error:session_expired",
      details: "The session has expired; reconnect to refresh",
      status: ClientError.Status.Unauthorized,
      data: { expiresAt: session.expiresAt.toISOString() },
    });
  }
}
