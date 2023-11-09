import { OpenIdDisplayMode } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestLogoutSession,
} from "../../fixtures/entity";
import { tryFindBrowserSessions as _tryFindBrowserSessions } from "../../handler";
import {
  assertPostLogoutRedirectUri as _assertPostLogoutRedirectUri,
  createLogoutPendingUri as _createLogoutPendingUri,
} from "../../util";
import { oauthLogoutController } from "./initialise-logout";

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
      redis: {
        logoutSessionCache: createMockRedisRepository(createTestLogoutSession),
      },
      data: {
        clientId: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
        displayMode: OpenIdDisplayMode.WAP,
        idTokenHint: "id.jwt.jwt",
        logoutHint: "logout_hint",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        uiLocales: "en-GB sv-SE",
        state: "76d3d90c16bee315",
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
      request: {
        originalUrl: "/oauth2/sessions/logout?query=query",
      },
      token: {
        idToken: {
          metadata: { client: "097adea7-58d4-43cc-aeb3-f7f9879adb56" },
          token: "id.jwt.jwt",
        },
      },
    };

    assertPostLogoutRedirectUri.mockImplementation();
    createLogoutPendingUri.mockReturnValue("createLogoutPendingUri");
    tryFindBrowserSessions.mockResolvedValue([
      createTestBrowserSession({
        id: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
      }),
    ]);
  });

  test("should resolve", async () => {
    ctx.mongo.clientSessionRepository.tryFind.mockResolvedValue(
      createTestClientSession({
        id: "078de016-11e5-4d65-9976-4c0f3aa1125b",
        clientId: "04878ee1-7617-4290-a3b4-c4fed4b1a836",
        browserSessionId: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
      }),
    );

    await expect(oauthLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "createLogoutPendingUri",
    });

    expect(assertPostLogoutRedirectUri).toHaveBeenCalled();
    expect(ctx.redis.logoutSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "097adea7-58d4-43cc-aeb3-f7f9879adb56",
        confirmedLogout: {
          browserSessionId: null,
          clientSessionId: null,
        },
        created: expect.any(Date),
        displayMode: "wap",
        expires: new Date("2022-01-01T08:01:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identityId: expect.any(String),
        logoutHint: "logout_hint",
        originalUri: "https://oauth.test.lindorm.io/oauth2/sessions/logout?query=query",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          browserSessionId: "cbda49e5-d3e4-4382-9f7d-83a603f7ee49",
          clientSessionId: "078de016-11e5-4d65-9976-4c0f3aa1125b",
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
    ctx.token.idToken.metadata.client = undefined;

    await expect(oauthLogoutController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on inactive client", async () => {
    ctx.mongo.clientRepository.find.mockResolvedValue(
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
