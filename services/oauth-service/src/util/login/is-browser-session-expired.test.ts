import * as MockDate from "mockdate";
import { BrowserSession } from "../../entity";
import { createTestBrowserSession } from "../../fixtures/entity";
import { isBrowserSessionExpired } from "./is-browser-session-expired";

MockDate.set("2023-04-01T23:00:00.000Z");

describe("isBrowserSessionExpired", () => {
  let browserSession: BrowserSession;

  beforeEach(() => {
    browserSession = createTestBrowserSession();
  });

  test("should consider session expired on ephemeral session", () => {
    browserSession.latestAuthentication = new Date("2023-04-01T02:00:00.000Z");
    browserSession.remember = false;

    expect(isBrowserSessionExpired(browserSession)).toBe(true);
  });

  test("should consider session expired on remembered session", () => {
    browserSession.latestAuthentication = new Date("2023-01-01T00:00:01.000Z");
    browserSession.remember = true;

    expect(isBrowserSessionExpired(browserSession)).toBe(true);
  });

  test("should not consider session expired on ephemeral session", () => {
    browserSession.latestAuthentication = new Date("2023-04-01T22:00:00.000Z");
    browserSession.remember = false;

    expect(isBrowserSessionExpired(browserSession)).toBe(false);
  });

  test("should not consider session expired on remembered session", () => {
    browserSession.latestAuthentication = new Date("2023-03-03T00:00:00.000Z");
    browserSession.remember = true;

    expect(isBrowserSessionExpired(browserSession)).toBe(false);
  });
});
