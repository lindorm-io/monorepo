import { createAccessToken } from "./create-access-token";
import {
  createTestAccessSession,
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

  test("should create access token for access session", () => {
    expect(createAccessToken(ctx, createTestClient(), createTestAccessSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "access",
      }),
    );
  });

  test("should create access token for refresh session", () => {
    expect(createAccessToken(ctx, createTestClient(), createTestRefreshSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
      }),
    );
  });
});
