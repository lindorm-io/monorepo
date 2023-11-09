import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { randomUUID } from "crypto";
import { BrowserSession, BrowserSessionOptions } from "../../entity";

export const createTestBrowserSession = (
  options: Partial<BrowserSessionOptions> = {},
): BrowserSession =>
  new BrowserSession({
    factors: [AuthenticationFactor.TWO_FACTOR],
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    remember: true,
    singleSignOn: true,
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
    ...options,
  });
