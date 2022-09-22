import { LogoutSessionType } from "../../../enum";
import { oauthLogoutController } from "./logout";
import { createMockCache } from "@lindorm-io/redis";
import { findSessionToLogout as _findSessionToLogout } from "../../../handler";
import {
  createTestClient,
  createTestBrowserSession,
  createTestLogoutSession,
} from "../../../fixtures/entity";

jest.mock("../../../handler");

const findSessionToLogout = _findSessionToLogout as jest.Mock;

describe("oauthLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      data: {
        redirectUri: "https://logout-redirect.uri/callback",
        state: "76d3d90c16bee315",
      },
      entity: {
        client: createTestClient(),
      },
      request: {
        originalUrl: "/oauth2/sessions/logout?query=query",
      },
      token: {
        idToken: {
          subject: "idTokenSubject",
          sessionHint: "sessionHint",
        },
      },
    };

    findSessionToLogout.mockResolvedValue({
      session: createTestBrowserSession(),
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
  });
});
