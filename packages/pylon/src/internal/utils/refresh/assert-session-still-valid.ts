import { ClientError } from "@lindorm/errors";
import { IPylonSession } from "../../../interfaces";

export function assertSessionStillValid(
  session: IPylonSession | null | undefined,
  now: Date,
): asserts session is IPylonSession {
  if (!session) {
    throw new ClientError("Session invalidated", {
      details: "The session is no longer present in the store",
      status: ClientError.Status.Unauthorized,
    });
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now.getTime()) {
    throw new ClientError("Session expired", {
      details: "The session has expired; reconnect to refresh",
      status: ClientError.Status.Unauthorized,
    });
  }
}
