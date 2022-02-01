import { Client } from "../../entity";
import { createClientCredentialsToken } from "./create-client-credentials-token";
import { getTestClient } from "../../test/entity";

describe("createClientCredentialsToken", () => {
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

  test("should create client credentials token", () => {
    expect(createClientCredentialsToken(ctx, client)).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
