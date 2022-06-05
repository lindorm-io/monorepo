import { Client } from "../../entity";
import { createRefreshToken } from "./create-refresh-token";
import { createTestClient, createTestRefreshSession } from "../../fixtures/entity";

describe("createRefreshToken", () => {
  let ctx: any;
  let client: Client;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };

    client = createTestClient();
  });

  test("should create refresh token", () => {
    expect(createRefreshToken(ctx, client, createTestRefreshSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
