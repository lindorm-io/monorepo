import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { oauthLogoutController } from "./initialise-logout";
import { tryFindBrowserSessions as _tryFindBrowserSessions } from "../../handler";
import {
  assertPostLogoutRedirectUri as _assertPostLogoutRedirectUri,
  createLogoutPendingUri as _createLogoutPendingUri,
} from "../../util";
import {
  createTestClient,
  createTestBrowserSession,
  createTestLogoutSession,
  createTestAccessSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const assertPostLogoutRedirectUri = _assertPostLogoutRedirectUri as jest.Mock;
const createLogoutPendingUri = _createLogoutPendingUri as jest.Mock;
const tryFindBrowserSessions = _tryFindBrowserSessions as jest.Mock;

describe("oauthLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      data: {
        clientId: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
        idTokenHint: "id.jwt.jwt",
        logoutHint: "logout_hint",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        uiLocales: "en-GB sv-SE",
        state: "76d3d90c16bee315",
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
      request: {
        originalUrl: "/oauth2/sessions/logout?query=query",
      },
      token: {
        idToken: {
          client: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
          token: "id.jwt.jwt",
        },
      },
    };

    assertPostLogoutRedirectUri.mockImplementation();
    createLogoutPendingUri.mockImplementation(() => "createLogoutPendingUri");
    tryFindBrowserSessions.mockResolvedValue([
      createTestBrowserSession({
        id: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
      }),
    ]);
  });

  test("should resolve", async () => {
    ctx.repository.accessSessionRepository.findMany.mockResolvedValue([
      createTestAccessSession({
        id: "946b598c-6873-4a95-b987-230380afa3ff",
        clientId: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
        browserSessionId: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
      }),
    ]);

    await expect(oauthLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutPendingUri",
    });

    expect(assertPostLogoutRedirectUri).toHaveBeenCalled();
    expect(ctx.cache.logoutSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
        confirmedLogout: {
          accessSessionId: null,
          browserSessionId: null,
          refreshSessionId: null,
        },
        created: expect.any(Date),
        expires: new Date("2022-01-01T08:01:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identityId: expect.any(String),
        logoutHint: "logout_hint",
        originalUri: "https://oauth.test.lindorm.io/oauth2/sessions/logout?query=query",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          accessSessionId: "946b598c-6873-4a95-b987-230380afa3ff",
          accessSessions: [expect.any(String)],
          browserSessionId: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
          refreshSessionId: null,
          refreshSessions: [expect.any(String)],
        },
        state: "76d3d90c16bee315",
        status: "pending",
        uiLocales: ["en-GB", "sv-SE"],
        updated: expect.any(Date),
      }),
    );
  });

  test("should throw on invalid client id", async () => {
    ctx.data.clientId = "wrong";

    await expect(oauthLogoutController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on missing client id", async () => {
    ctx.data.clientId = undefined;
    ctx.token.idToken.client = undefined;

    await expect(oauthLogoutController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on inactive client", async () => {
    ctx.cache.clientCache.find.mockResolvedValue(
      createTestClient({
        active: false,
      }),
    );

    await expect(oauthLogoutController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on too many browser sessions", async () => {
    tryFindBrowserSessions.mockResolvedValue([
      createTestBrowserSession(),
      createTestBrowserSession(),
    ]);

    await expect(oauthLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
