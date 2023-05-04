import { AuthenticationMethod } from "@lindorm-io/common-types";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { AuthorizationSession, BrowserSession } from "../../entity";
import { createTestAuthorizationSession, createTestBrowserSession } from "../../fixtures/entity";
import { getUpdatedBrowserSession } from "./get-updated-browser-session";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getUpdatedBrowserSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      confirmedLogin: {
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        metadata: {},
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: true,
        singleSignOn: true,
      },
      browserSessionId: "052ef2f3-01d8-4e0c-9c3c-8daae8a8e541",
    });
  });

  test("should resolve created browser session on missing session", async () => {
    authorizationSession.browserSessionId = null;

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "phone", "session_link"],
        remember: true,
        singleSignOn: true,
      }),
    );
  });

  test("should resolve created browser session on mismatched identity", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValueOnce(
      createTestBrowserSession({
        identityId: "be83d954-ae47-49e4-90a3-b3fedc5f8bff",
      }),
    );

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
      }),
    );
  });

  test("should resolve updated browser session", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValueOnce(
      createTestBrowserSession({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 1,
        methods: [AuthenticationMethod.PASSWORD],
        remember: false,
        singleSignOn: false,
      }),
    );

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "password", "phone", "session_link"],
        remember: true,
        singleSignOn: true,
      }),
    );
  });

  test("should keep immutable values once set", async () => {
    authorizationSession.confirmedLogin.levelOfAssurance = 1;
    authorizationSession.confirmedLogin.remember = false;
    authorizationSession.confirmedLogin.singleSignOn = false;

    ctx.mongo.browserSessionRepository.find.mockResolvedValueOnce(
      createTestBrowserSession({
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.PASSWORD],
        remember: true,
        singleSignOn: true,
      }),
    );

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["email", "password", "phone", "session_link"],
        remember: true,
        singleSignOn: true,
      }),
    );
  });
});
