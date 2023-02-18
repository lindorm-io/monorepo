import MockDate from "mockdate";
import { createMockLogger } from "@lindorm-io/core-logger";
import { setBrowserSessionCookies } from "./set-browser-session-cookies";
import { BROWSER_SESSIONS_COOKIE_NAME } from "../../constant";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("setBrowserSessionCookies", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
      },
      logger: createMockLogger(),
      server: {
        environment: "test",
      },
    };
  });

  test("should set cookies", () => {
    expect(() => setBrowserSessionCookies(ctx, ["one", "two"])).not.toThrow();

    expect(ctx.cookies.set).toHaveBeenCalledWith(BROWSER_SESSIONS_COOKIE_NAME, '["one","two"]', {
      expires: new Date("2120-01-01T08:00:00.000Z"),
      httpOnly: true,
      overwrite: true,
      signed: false,
    });
  });

  test("should remove cookies", () => {
    expect(() => setBrowserSessionCookies(ctx, [])).not.toThrow();

    expect(ctx.cookies.set).toHaveBeenCalledWith(BROWSER_SESSIONS_COOKIE_NAME);
  });
});
