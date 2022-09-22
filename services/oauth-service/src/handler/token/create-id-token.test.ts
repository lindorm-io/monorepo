import { createIdToken } from "./create-id-token";
import {
  createTestClient,
  createTestBrowserSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

describe("createIdToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };
  });

  test("should create id token for browser session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestBrowserSession(), {
        audiences: ["75f2e509-d2e2-4454-8f2d-3294322847d9"],
        claims: { email: "test@lindorm.io" },
        nonce: "Aem5ldu1tdUgrd9C",
        scopes: ["scope1", "scope2"],
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "browser",
      }),
    );
  });

  test("should create id token for refresh session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestRefreshSession(), {
        audiences: ["75f2e509-d2e2-4454-8f2d-3294322847d9"],
        claims: { email: "test@lindorm.io" },
        nonce: "Aem5ldu1tdUgrd9C",
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
