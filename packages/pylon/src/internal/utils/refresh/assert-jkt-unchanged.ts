import { ClientError } from "@lindorm/errors";

export const assertJktUnchanged = (
  expected: string | undefined,
  actual: string | undefined,
): void => {
  if (!expected) return;

  if (!actual || actual !== expected) {
    throw new ClientError("DPoP key rotation requires reconnect", {
      details: "The refreshed token cnf.jkt does not match the handshake binding",
      status: ClientError.Status.Unauthorized,
    });
  }
};
