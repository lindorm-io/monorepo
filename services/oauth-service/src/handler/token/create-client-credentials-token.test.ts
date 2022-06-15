import { createClientCredentialsToken } from "./create-client-credentials-token";
import { createTestClient } from "../../fixtures/entity";

describe("createClientCredentialsToken", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
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
