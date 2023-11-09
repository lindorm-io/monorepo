import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
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
        factors: [AuthenticationFactor.TWO_FACTOR],
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
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
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
        factors: [AuthenticationFactor.TWO_FACTOR],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: true,
        singleSignOn: true,
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
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
        factors: [AuthenticationFactor.ONE_FACTOR],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 1,
        methods: [AuthenticationMethod.PASSWORD],
        remember: false,
        singleSignOn: false,
        strategies: [AuthenticationStrategy.PASSWORD],
      }),
    );

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        factors: [AuthenticationFactor.ONE_FACTOR, AuthenticationFactor.TWO_FACTOR],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PASSWORD,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: true,
        singleSignOn: true,
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PASSWORD,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
      }),
    );
  });

  test("should keep immutable values once set", async () => {
    authorizationSession.confirmedLogin.levelOfAssurance = 1;
    authorizationSession.confirmedLogin.remember = false;
    authorizationSession.confirmedLogin.singleSignOn = false;

    ctx.mongo.browserSessionRepository.find.mockResolvedValueOnce(
      createTestBrowserSession({
        factors: [AuthenticationFactor.ONE_FACTOR],
        identityId: "7a658184-a059-478d-a003-9a50c411ef64",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.PASSWORD],
        remember: true,
        singleSignOn: true,
        strategies: [AuthenticationStrategy.PASSWORD],
      }),
    );

    await expect(getUpdatedBrowserSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(BrowserSession),
    );

    expect(ctx.mongo.browserSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        factors: [AuthenticationFactor.ONE_FACTOR, AuthenticationFactor.TWO_FACTOR],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PASSWORD,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: true,
        singleSignOn: true,
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PASSWORD,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
      }),
    );
  });
});
