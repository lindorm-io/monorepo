import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
} from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import { ClaimsSession, ClaimsSessionOptions } from "../../entity";

export const createTestClaimsSession = (
  options: Partial<ClaimsSessionOptions> = {},
): ClaimsSession =>
  new ClaimsSession({
    audiences: [randomUUID()],
    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    scopes: [Scope.OPENID, Scope.PROFILE],
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
    ...options,
  });
