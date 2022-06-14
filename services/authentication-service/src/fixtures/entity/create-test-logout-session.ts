import { LogoutSession, LogoutSessionOptions } from "../../entity";
import { ClientType } from "../../common";
import { randomUUID } from "crypto";

export const createTestLogoutSession = (
  options: Partial<LogoutSessionOptions> = {},
): LogoutSession =>
  new LogoutSession({
    description: "description",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    logoUri: "https://client.logo.uri/",
    name: "name",
    oauthSessionId: randomUUID(),
    type: ClientType.PUBLIC,
    ...options,
  });
