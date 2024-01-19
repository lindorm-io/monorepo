import { createOpaqueToken } from "@lindorm-io/jwt";
import { randomUUID } from "crypto";
import { OpaqueToken, OpaqueTokenOptions } from "../../entity";
import { OpaqueTokenType } from "../../enum";

export const createTestAccessToken = (options: Partial<OpaqueTokenOptions> = {}): OpaqueToken => {
  const { id, signature } = createOpaqueToken();

  return new OpaqueToken({
    id,
    clientSessionId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    roles: ["role1", "role2"],
    signature,
    type: OpaqueTokenType.ACCESS,

    ...options,
  });
};
