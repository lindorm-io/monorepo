import { createMockLogger } from "@lindorm-io/core-logger";
import { getBrowserSessionCookies } from "./get-browser-session-cookies";

describe("getBrowserSessionCookies", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cookies: {
        get: jest.fn(),
      },
      logger: createMockLogger(),
      server: {
        environment: "test",
      },
    };
  });

  test("should get cookies", () => {
    ctx.cookies.get.mockImplementation(() => '["one","two"]');

    expect(getBrowserSessionCookies(ctx)).toStrictEqual(["one", "two"]);
  });

  test("should resolve empty array", () => {
    expect(getBrowserSessionCookies(ctx)).toStrictEqual([]);
  });
});
