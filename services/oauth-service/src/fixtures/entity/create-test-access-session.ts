import { AccessSession, AccessSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { AuthenticationMethod, OpenIdScope } from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";

export const createTestAccessSession = (
  options: Partial<AccessSessionOptions> = {},
): AccessSession =>
  new AccessSession({
    audiences: [randomUUID()],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    nonce: randomString(16),
    scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
    ...options,
  });
