import { Scope } from "@lindorm-io/common-enums";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { randomUUID } from "crypto";
import { AuthenticationTokenSession, AuthenticationTokenSessionOptions } from "../../entity";

export const createTestAuthenticationTokenSession = (
  options: Partial<AuthenticationTokenSessionOptions> = {},
): AuthenticationTokenSession =>
  new AuthenticationTokenSession({
    audiences: [randomUUID()],
    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    scopes: [Scope.OPENID, Scope.PROFILE],
    token: createOpaqueToken().token,
    ...options,
  });
