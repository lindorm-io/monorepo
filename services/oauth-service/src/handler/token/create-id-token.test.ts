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
