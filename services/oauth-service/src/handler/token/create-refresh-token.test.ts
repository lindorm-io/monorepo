import { createRefreshToken } from "./create-refresh-token";
import { createTestClient, createTestRefreshSession } from "../../fixtures/entity";

describe("createRefreshToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };
  });

  test("should create refresh token", () => {
    expect(createRefreshToken(ctx, createTestClient(), createTestRefreshSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionHint: "refresh",
      }),
    );
  });
});
