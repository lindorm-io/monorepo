import { createIdToken } from "./create-id-token";
import { createTestClient, createTestClientSession } from "../../fixtures/entity";

describe("createIdToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
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
});
