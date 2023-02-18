import { createIdToken } from "./create-id-token";
import {
  createTestClient,
  createTestAccessSession,
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

  test("should create id token for access session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestAccessSession(), {
        email: "test@lindorm.io",
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: { email: "test@lindorm.io" },
        sessionHint: "access",
      }),
    );
  });

  test("should create id token for refresh session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestRefreshSession(), {
        email: "test@lindorm.io",
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        claims: { email: "test@lindorm.io" },
        sessionHint: "refresh",
      }),
    );
  });
});
