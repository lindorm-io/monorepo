import { randomUUID } from "crypto";
import { createTestAuthorizationRequest } from "../../fixtures/entity";
import { verifyBrowserSessions } from "./verify-browser-sessions";

describe("verifyBrowserSessions", () => {
  test("should return true if there is only one browser session", () => {
    expect(
      verifyBrowserSessions(
        createTestAuthorizationRequest({
          requestedSelectAccount: {
            browserSessions: [{ browserSessionId: randomUUID(), identityId: randomUUID() }],
          },
        }),
      ),
    ).toBe(true);
  });

  test("should return true if there are no browser sessions", () => {
    expect(
      verifyBrowserSessions(
        createTestAuthorizationRequest({
          requestedSelectAccount: {
            browserSessions: [],
          },
        }),
      ),
    ).toBe(true);
  });

  test("should return false if there are more than one browser sessions", () => {
    expect(
      verifyBrowserSessions(
        createTestAuthorizationRequest({
          requestedSelectAccount: {
            browserSessions: [
              { browserSessionId: randomUUID(), identityId: randomUUID() },
              { browserSessionId: randomUUID(), identityId: randomUUID() },
              { browserSessionId: randomUUID(), identityId: randomUUID() },
            ],
          },
        }),
      ),
    ).toBe(false);
  });
});
