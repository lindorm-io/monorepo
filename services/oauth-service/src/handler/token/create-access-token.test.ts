import { Client } from "../../entity";
import { createAccessToken } from "./create-access-token";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";

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

    client = createTestClient();
    scopes = ["scope1", "scope2"];
  });

  test("should create access token for browser session", () => {
    expect(
      createAccessToken(ctx, client, createTestBrowserSession(), {
        permissions: [],
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });

  test("should create access token for refresh session", () => {
    expect(
      createAccessToken(ctx, client, createTestRefreshSession(), {
        permissions: [],
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
