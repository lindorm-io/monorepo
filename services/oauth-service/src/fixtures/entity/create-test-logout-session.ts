import { LogoutSession, LogoutSessionOptions } from "../../entity";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const createTestLogoutSession = (
  options: Partial<LogoutSessionOptions> = {},
): LogoutSession =>
  new LogoutSession({
    requestedLogout: {
      accessSessionId: randomUUID(),
      accessSessions: [randomUUID()],
      browserSessionId: randomUUID(),
      refreshSessionId: null,
      refreshSessions: [],
      ...(options.requestedLogout || {}),
    },

    clientId: randomUUID(),
    expires: new Date("2021-01-02T08:00:00.000Z"),
    idTokenHint: "jwt.jwt.jwt",
    identityId: randomUUID(),
    logoutHint: "logout-hint",
    originalUri: "https://localhost/oauth2/sessions/logout?query=query",
    postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
    state: randomString(16),
    status: "pending",
    uiLocales: ["en-GB"],

    ...options,
  });
