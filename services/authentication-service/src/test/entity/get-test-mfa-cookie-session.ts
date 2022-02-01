import { MfaCookieSession, MfaCookieSessionOptions } from "../../entity";

export const getTestMfaCookieSession = (
  options: Partial<MfaCookieSessionOptions> = {},
): MfaCookieSession =>
  new MfaCookieSession({
    identityId: "72cfccb7-de1c-4f41-9bd0-d53c235578f9",
    ...options,
  });
