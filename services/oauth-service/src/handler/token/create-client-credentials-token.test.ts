import { createTestClient } from "../../fixtures/entity";
import { createClientCredentialsToken } from "./create-client-credentials-token";

describe("createClientCredentialsToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockReturnValue("signed"),
      },
    };
  });

  test("should create client credentials token", () => {
    expect(createClientCredentialsToken(ctx, createTestClient(), ["scope1", "scope2"])).toBe(
      "signed",
    );

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
