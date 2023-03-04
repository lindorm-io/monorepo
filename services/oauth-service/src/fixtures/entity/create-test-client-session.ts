import { AuthenticationMethod, OpenIdScope } from "@lindorm-io/common-types";
import { ClientSession, ClientSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/random";
import { ClientSessionType } from "../../enum";

export const createTestClientSession = (
  options: Partial<ClientSessionOptions> = {},
): ClientSession =>
  new ClientSession({
    audiences: [randomUUID()],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "10.0.0.1", deviceName: "Test Device", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    nonce: randomString(16),
    scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
    tenantId: randomUUID(),
    type: ClientSessionType.REFRESH,
    ...options,
  });
