import MockDate from "mockdate";
import { getTestAuthorizationSession, getTestBrowserSession } from "../../test/entity";
import { isAuthenticationRequiredByMaxAge } from "./is-authentication-required-by-max-age";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("isAuthenticationRequiredByMaxAge", () => {
  test("should return true when maxAge is lower than auth age", () => {
    const authorizationSession = getTestAuthorizationSession({
      maxAge: 600,
    });
    const browserSession = getTestBrowserSession({
      latestAuthentication: new Date("2021-01-01T07:00:00.000Z"),
    });

    expect(isAuthenticationRequiredByMaxAge(authorizationSession, browserSession)).toBe(true);
  });

  test("should return false when maxAge is higher than auth age", () => {
    const authorizationSession = getTestAuthorizationSession({
      maxAge: 7200,
    });
    const browserSession = getTestBrowserSession({
      latestAuthentication: new Date("2021-01-01T07:00:00.000Z"),
    });

    expect(isAuthenticationRequiredByMaxAge(authorizationSession, browserSession)).toBe(false);
  });

  test("should return false when maxAge does not exist", () => {
    const authorizationSession = getTestAuthorizationSession({
      maxAge: null,
    });
    const browserSession = getTestBrowserSession({
      latestAuthentication: null,
    });

    expect(isAuthenticationRequiredByMaxAge(authorizationSession, browserSession)).toBe(false);
  });

  test("should return true when latestAuthentication does not exist", () => {
    const authorizationSession = getTestAuthorizationSession({
      maxAge: 600,
    });
    const browserSession = getTestBrowserSession({
      latestAuthentication: null,
    });

    expect(isAuthenticationRequiredByMaxAge(authorizationSession, browserSession)).toBe(true);
  });
});
