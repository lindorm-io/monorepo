import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";
import { randomUUID } from "crypto";
import { MfaCookieSession, MfaCookieSessionOptions } from "../../entity";

export const createTestMfaCookieSession = (
  options: Partial<MfaCookieSessionOptions> = {},
): MfaCookieSession =>
  new MfaCookieSession({
    expires: new Date("2023-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 3,
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    strategies: [AuthenticationStrategy.EMAIL_CODE, AuthenticationStrategy.PHONE_OTP],
    ...options,
  });
