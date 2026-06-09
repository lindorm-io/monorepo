import { ClientError } from "@lindorm/errors";

export const assertJktUnchanged = (
  expected: string | undefined,
  actual: string | undefined,
): void => {
  if (!expected) return;

  if (!actual || actual !== expected) {
    throw new ClientError("DPoP key rotation requires reconnect", {
      code: "dpop_jkt_changed",
      title: "DPoP JKT Changed",
      type: "urn:lindorm:pylon:error:dpop_jkt_changed",
      details: "The refreshed token cnf.jkt does not match the handshake binding",
      status: ClientError.Status.Unauthorized,
      debug: { expected, actual },
    });
  }
};
