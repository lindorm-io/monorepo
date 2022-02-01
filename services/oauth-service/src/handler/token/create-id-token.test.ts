import { Client } from "../../entity";
import { createIdToken } from "./create-id-token";
import { getTestClient, getTestBrowserSession, getTestRefreshSession } from "../../test/entity";

describe("createIdToken", () => {
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

  test("should create id token for browser session", async () => {
    await expect(
      createIdToken(ctx, client, getTestBrowserSession(), {
        claims: { email: "test@lindorm.io" },
        nonce: "Aem5ldu1tdUgrd9C",
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });

  test("should create id token for refresh session", async () => {
    await expect(
      createIdToken(ctx, client, getTestRefreshSession(), {
        claims: { email: "test@lindorm.io" },
        nonce: "Aem5ldu1tdUgrd9C",
        scopes,
      }),
    ).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
