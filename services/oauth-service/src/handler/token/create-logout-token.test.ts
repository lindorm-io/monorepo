import { BrowserSession, Client } from "../../entity";
import { getTestBrowserSession, getTestClient } from "../../test/entity";
import { createLogoutToken } from "./create-logout-token";

describe("createLogoutToken", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      jwt: {
        sign: jest.fn().mockImplementation(() => "signed"),
      },
    };

    browserSession = getTestBrowserSession({
      id: "58c9e5aa-c576-43a5-97a1-9bde154eda75",
    });
    client = getTestClient({
      id: "a95372ca-c721-4c53-8ac3-c16d61943b21",
    });
  });

  test("should create logout token", () => {
    expect(createLogoutToken(ctx, client, browserSession)).toBe("signed");

    expect(ctx.jwt.sign).toHaveBeenCalled();
  });
});
