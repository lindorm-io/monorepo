import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "@lindorm-io/common-types";

export const assertSessionPending = (status: SessionStatus): void => {
  if (status === SessionStatus.PENDING) return;

  throw new ClientError("Invalid session status", {
    description: "Session is not pending",
    data: {
      expect: SessionStatus.PENDING,
      actual: status,
    },
  });
};
