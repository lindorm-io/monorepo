import { createAccessToken } from "./create-access-token";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("createAccessToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };
  });

  test("should create access token for browser session", () => {
    expect(
      createAccessToken(ctx, createTestClient(), createTestBrowserSession(), {
        permissions: [],
        scopes: ["scope1", "scope2"],
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "browser",
      }),
    );
  });

  test("should create access token for refresh session", () => {
    expect(
      createAccessToken(ctx, createTestClient(), createTestRefreshSession(), {
        permissions: [],
        scopes: ["scope1", "scope2"],
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
      }),
    );
  });
});
