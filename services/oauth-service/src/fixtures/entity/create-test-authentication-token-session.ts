import { OpenIdScope } from "@lindorm-io/common-types";
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
    scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
    token: createOpaqueToken().token,
    ...options,
  });
