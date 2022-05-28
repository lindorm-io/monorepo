import { LogoutSessionType } from "../../enum";
import { getTestClient, getTestBrowserSession } from "../../test/entity";
import { oauthLogoutController } from "./logout";
import {
  findSessionToLogout as _findSessionToLogout,
  setLogoutSessionCookie as _setLogoutSessionCookie,
} from "../../handler";

jest.mock("../../handler");

const findSessionToLogout = _findSessionToLogout as jest.Mock;
const setLogoutSessionCookie = _setLogoutSessionCookie as jest.Mock;

describe("oauthLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: {
          create: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        redirectUri: "https://logout-redirect.uri/callback",
        state: "76d3d90c16bee315",
      },
      entity: {
        client: getTestClient(),
      },
      request: {
        originalUrl: "/oauth2/sessions/logout?query=query",
      },
      token: {
        idToken: {
          subject: "idTokenSubject",
        },
      },
    };

    findSessionToLogout.mockResolvedValue({
      session: getTestBrowserSession(),
      type: LogoutSessionType.BROWSER,
    });
  });

  test("should resolve URL", async () => {
    const response = (await oauthLogoutController(ctx)) as any;

    expect(response).toStrictEqual({
      redirect: expect.any(URL),
    });

    const url = response.redirect as URL;

    expect(url.searchParams.get("session_id")).toStrictEqual(expect.any(String));

    expect(setLogoutSessionCookie).toHaveBeenCalled();
  });
});
