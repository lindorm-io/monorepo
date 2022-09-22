import { AuthenticationMethod } from "../../common";
import { MfaCookieSession, MfaCookieSessionOptions } from "../../entity";
import { randomUUID } from "crypto";

export const createTestMfaCookieSession = (
  options: Partial<MfaCookieSessionOptions> = {},
): MfaCookieSession =>
  new MfaCookieSession({
    expires: new Date("2023-01-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 3,
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    ...options,
  });
