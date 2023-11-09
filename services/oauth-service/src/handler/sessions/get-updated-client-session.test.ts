import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
} from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { AuthorizationSession, Client, ClientSession } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { getUpdatedClientSession } from "./get-updated-client-session";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getUpdatedClientSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      mongo: {
        clientSessionRepository: createMockMongoRepository((opts) =>
          createTestClientSession({
            audiences: ["0711b0ea-dd30-457c-b73c-92283762ef55"],
            identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
            latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
            levelOfAssurance: 2,
            methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
            scopes: ["openid", "profile"],
            ...opts,
          }),
        ),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      confirmedConsent: {
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        scopes: [Scope.OPENID, Scope.PROFILE],
      },
      confirmedLogin: {
        factors: [AuthenticationFactor.TWO_FACTOR],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        metadata: { metadata: true },
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: false,
        singleSignOn: false,
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
      },
      clientSessionId: "052ef2f3-01d8-4e0c-9c3c-8daae8a8e541",
      browserSessionId: "52f23e8f-68c5-4c17-b6cf-05b17d3de8f5",
      nonce: "pXPZUkDnAapOvKJg",
    });

    client = createTestClient({
      id: "9944553e-73e4-498f-b246-94ae3fb79d98",
      tenantId: "db7227ef-e88d-4282-9934-f6956777f31d",
    });
  });

  test("should resolve created client session on missing session", async () => {
    authorizationSession.clientSessionId = null;

    await expect(getUpdatedClientSession(ctx, authorizationSession, client)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        browserSessionId: "52f23e8f-68c5-4c17-b6cf-05b17d3de8f5",
        clientId: "9944553e-73e4-498f-b246-94ae3fb79d98",
        factors: [AuthenticationFactor.TWO_FACTOR],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        metadata: { metadata: true },
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        nonce: "pXPZUkDnAapOvKJg",
        scopes: ["openid", "profile"],
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
        tenantId: "db7227ef-e88d-4282-9934-f6956777f31d",
        type: "ephemeral",
      }),
    );
  });

  test("should resolve refresh session", async () => {
    authorizationSession.clientSessionId = null;
    authorizationSession.confirmedConsent.scopes.push(Scope.OFFLINE_ACCESS);

    await expect(getUpdatedClientSession(ctx, authorizationSession, client)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refresh",
      }),
    );
  });

  test("should resolve created client session on mismatched identity", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValueOnce(
      createTestClientSession({
        identityId: "be83d954-ae47-49e4-90a3-b3fedc5f8bff",
      }),
    );

    await expect(getUpdatedClientSession(ctx, authorizationSession, client)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
      }),
    );
  });

  test("should resolve updated client session", async () => {
    ctx.mongo.clientSessionRepository.find.mockResolvedValueOnce(
      createTestClientSession({
        audiences: ["0711b0ea-dd30-457c-b73c-92283762ef55"],
        factors: [AuthenticationFactor.ONE_FACTOR],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
        levelOfAssurance: 1,
        methods: [AuthenticationMethod.PASSWORD],
        scopes: [Scope.OPENID, Scope.PROFILE],
        strategies: [AuthenticationStrategy.PASSWORD],
      }),
    );

    await expect(getUpdatedClientSession(ctx, authorizationSession, client)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: [
          "0711b0ea-dd30-457c-b73c-92283762ef55",
          "6c04e67f-7911-4692-ab3b-f7b3f3178a40",
          "968db71c-3ea5-446a-a38e-cf614ec3168c",
        ],
        factors: [AuthenticationFactor.TWO_FACTOR],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
      }),
    );
  });

  test("should keep immutable values once set", async () => {
    authorizationSession.confirmedLogin.levelOfAssurance = 1;

    ctx.mongo.clientSessionRepository.find.mockResolvedValueOnce(
      createTestClientSession({
        factors: [AuthenticationFactor.ONE_FACTOR],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.PASSWORD],
        strategies: [AuthenticationStrategy.PASSWORD],
      }),
    );

    await expect(getUpdatedClientSession(ctx, authorizationSession, client)).resolves.toStrictEqual(
      expect.any(ClientSession),
    );

    expect(ctx.mongo.clientSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        factors: [AuthenticationFactor.TWO_FACTOR],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        strategies: [
          AuthenticationStrategy.EMAIL_CODE,
          AuthenticationStrategy.PHONE_OTP,
          AuthenticationStrategy.SESSION_OTP,
        ],
      }),
    );
  });
});
