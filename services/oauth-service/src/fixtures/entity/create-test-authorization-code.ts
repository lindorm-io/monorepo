import { AuthorizationCode, AuthorizationCodeOptions } from "../../entity";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestAuthorizationCode = (
  options: Partial<AuthorizationCodeOptions> = {},
): AuthorizationCode =>
  new AuthorizationCode({
    authorizationSessionId: randomUUID(),
    code: randomString(128),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    ...options,
  });
