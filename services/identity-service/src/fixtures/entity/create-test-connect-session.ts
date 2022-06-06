import { ConnectSession, ConnectSessionOptions } from "../../entity";
import { randomUUID } from "crypto";

export const createTestConnectSession = (
  options: Partial<ConnectSessionOptions> = {},
): ConnectSession =>
  new ConnectSession({
    code: "secret",
    expires: new Date("2029-01-01T08:00:00.000Z"),
    identifierId: randomUUID(),
    ...options,
  });
