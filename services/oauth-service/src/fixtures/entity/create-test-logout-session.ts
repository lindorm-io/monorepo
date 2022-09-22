import { LogoutSession, LogoutSessionOptions } from "../../entity";
import { LogoutSessionType } from "../../enum";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestLogoutSession = (
  options: Partial<LogoutSessionOptions> = {},
): LogoutSession =>
  new LogoutSession({
    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "jwt.jwt.jwt",
    originalUri: "https://localhost/oauth2/sessions/logout?query=query",
    redirectUri: "https://test.client.lindorm.io/redirect",
    sessionId: randomUUID(),
    sessionType: LogoutSessionType.BROWSER,
    state: randomString(16),
    ...options,
  });
