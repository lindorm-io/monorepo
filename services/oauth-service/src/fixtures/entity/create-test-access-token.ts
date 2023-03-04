import { OpaqueToken, OpaqueTokenOptions } from "../../entity";
import { randomUUID } from "crypto";
import { createOpaqueTokenString } from "../../util";
import { OpaqueTokenType } from "../../enum";

export const createTestAccessToken = (options: Partial<OpaqueTokenOptions> = {}): OpaqueToken =>
  new OpaqueToken({
    clientSessionId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    token: createOpaqueTokenString(),
    type: OpaqueTokenType.ACCESS,

    ...options,
  });
