import { Client } from "../../entity";
import { createRefreshToken } from "./create-refresh-token";
import { getTestClient, getTestRefreshSession } from "../../test/entity";

describe("createRefreshToken", () => {
  let ctx: any;
  let client: Client;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };

    client = getTestClient();
  });

  test("should create refresh token", () => {
    expect(createRefreshToken(ctx, client, getTestRefreshSession())).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
