import { Client } from "../../entity";
import { createAccessToken } from "./create-access-token";
import { getTestBrowserSession, getTestClient, getTestRefreshSession } from "../../test/entity";

describe("createAccessToken", () => {
  let ctx: any;
  let client: Client;
  let scopes: Array<string>;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };

    client = getTestClient();
    scopes = ["scope1", "scope2"];
  });

  test("should create access token for browser session", () => {
    expect(
      createAccessToken(ctx, client, getTestBrowserSession(), {
        permissions: [],
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });

  test("should create access token for refresh session", () => {
    expect(
      createAccessToken(ctx, client, getTestRefreshSession(), {
        permissions: [],
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
