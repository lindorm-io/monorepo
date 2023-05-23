import MockDate from "mockdate";
import { createTestAuthorizationRequest, createTestBrowserSession } from "../../fixtures/entity";
import { verifyMaxAge } from "./verify-max-age";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("verifyMaxAge", () => {
  test("should return true when maxAge is higher than auth age", () => {
    const authorizationRequest = createTestAuthorizationRequest({
      maxAge: 7200,
    });
    const browserSession = createTestBrowserSession({
      latestAuthentication: new Date("2021-01-01T07:00:00.000Z"),
    });

    expect(verifyMaxAge(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return true when maxAge does not exist", () => {
    const authorizationRequest = createTestAuthorizationRequest({
      maxAge: null,
    });
    const browserSession = createTestBrowserSession({});

    expect(verifyMaxAge(authorizationRequest, browserSession)).toBe(true);
  });

  test("should return false when maxAge is lower than auth age", () => {
    const authorizationRequest = createTestAuthorizationRequest({
      maxAge: 600,
    });
    const browserSession = createTestBrowserSession({
      latestAuthentication: new Date("2021-01-01T07:00:00.000Z"),
    });

    expect(verifyMaxAge(authorizationRequest, browserSession)).toBe(false);
  });
});
