import { MfaCookieSession, MfaCookieSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { AuthenticationMethod } from "../../enum";

export const createTestMfaCookieSession = (
  options: Partial<MfaCookieSessionOptions> = {},
): MfaCookieSession =>
  new MfaCookieSession({
    identityId: randomUUID(),
    levelOfAssurance: 3,
    methods: [AuthenticationMethod.EMAIL_LINK, AuthenticationMethod.PHONE_OTP],
    ...options,
  });
