import { ClaimsSession, ClaimsSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { AuthenticationMethod, OpenIdScope } from "@lindorm-io/common-types";

export const createTestClaimsSession = (
  options: Partial<ClaimsSessionOptions> = {},
): ClaimsSession =>
  new ClaimsSession({
    audiences: [randomUUID()],
    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
    ...options,
  });
