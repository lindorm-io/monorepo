import { createOpaqueToken } from "@lindorm-io/jwt";
import { randomUUID } from "crypto";
import { OpaqueToken, OpaqueTokenOptions } from "../../entity";
import { OpaqueTokenType } from "../../enum";

export const createTestAccessToken = (options: Partial<OpaqueTokenOptions> = {}): OpaqueToken =>
  new OpaqueToken({
    clientSessionId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    token: createOpaqueToken(),
    type: OpaqueTokenType.ACCESS,

    ...options,
  });
