import { ClientError } from "@lindorm-io/errors";
import { SessionStatus, SessionStatuses } from "@lindorm-io/common-types";

export const assertSessionPending = (status: SessionStatus): void => {
  if (status === SessionStatuses.PENDING) return;

  throw new ClientError("Invalid session status", {
    description: "Session is not pending",
    data: {
      expect: SessionStatuses.PENDING,
      actual: status,
    },
  });
};
