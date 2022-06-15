import { createLogoutToken } from "./create-logout-token";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("createLogoutToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };
  });

  test("should create logout token", () => {
    expect(createLogoutToken(ctx, createTestClient(), createTestBrowserSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "browser",
      }),
    );
  });

  test("should create logout token", () => {
    expect(createLogoutToken(ctx, createTestClient(), createTestRefreshSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
      }),
    );
  });
});
