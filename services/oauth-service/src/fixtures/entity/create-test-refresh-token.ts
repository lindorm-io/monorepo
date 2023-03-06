import { OpaqueToken, OpaqueTokenOptions } from "../../entity";
import { randomUUID } from "crypto";
import { createOpaqueToken } from "../../util";
import { OpaqueTokenType } from "../../enum";

export const createTestRefreshToken = (options: Partial<OpaqueTokenOptions> = {}): OpaqueToken =>
  new OpaqueToken({
    clientSessionId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    token: createOpaqueToken(),
    type: OpaqueTokenType.REFRESH,

    ...options,
  });
