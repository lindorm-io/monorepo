import { createTestClient, createTestClientSession } from "../../fixtures/entity";
import { createIdToken } from "./create-id-token";

describe("createIdToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        createHash: jest.fn().mockReturnValue("hashed_value"),
        sign: jest.fn().mockReturnValue("signed"),
      },
    };
  });

  test("should create id token for client session", async () => {
    await expect(
      createIdToken(ctx, createTestClient(), createTestClientSession(), {
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

  test("should create id token with hash", async () => {
    await expect(
      createIdToken(
        ctx,
        createTestClient(),
        createTestClientSession(),
        { email: "test@lindorm.io" },
        "accessToken",
      ),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        atHash: "hashed_value",
        claims: { email: "test@lindorm.io" },
        sessionHint: "refresh",
      }),
    );
  });
});
