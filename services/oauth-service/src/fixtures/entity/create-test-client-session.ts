import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdGrantType,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { randomHex, randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { ClientSession, ClientSessionOptions } from "../../entity";
import { ClientSessionType } from "../../enum";

export const createTestClientSession = (
  options: Partial<ClientSessionOptions> = {},
): ClientSession =>
  new ClientSession({
    audiences: [randomUUID()],
    authorizationGrant: OpenIdGrantType.AUTHORIZATION_CODE,
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    code: randomUnreserved(128),
    expires: new Date("2031-01-01T07:59:00.000Z"),
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "10.0.0.1", deviceName: "Test Device", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    nonce: randomHex(16),
    scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
    tenantId: randomUUID(),
    type: ClientSessionType.REFRESH,
    ...options,
  });
