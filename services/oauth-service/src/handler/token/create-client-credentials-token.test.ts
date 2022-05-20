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

    client = getTestClient({
      id: "dd40c850-07bf-4553-9ad3-6278fce82c24",
    });
  });

  test("should create client credentials token", () => {
    expect(createClientCredentialsToken(ctx, client, ["scope1", "scope2"])).toBe("signed");

    expect(ctx.jwt.sign.mock.calls).toMatchSnapshot();
  });
});
