import { randomUnreserved } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { AuthorizationCode, AuthorizationCodeOptions } from "../../entity";

export const createTestAuthorizationCode = (
  options: Partial<AuthorizationCodeOptions> = {},
): AuthorizationCode =>
  new AuthorizationCode({
    AuthorizationSessionId: randomUUID(),
    code: randomUnreserved(128),
    expires: new Date("2021-01-02T08:00:00.000Z"),

    ...options,
  });
