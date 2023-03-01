import MockDate from "mockdate";
import { AuthorizationSession, Client, RefreshSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { getUpdatedRefreshSession } from "./get-updated-refresh-session";
import {
  createTestAuthorizationSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import { AuthenticationMethod, OpenIdScope } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getUpdatedRefreshSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    ctx = {
      repository: {
        refreshSessionRepository: createMockRepository((opts) =>
          createTestRefreshSession({
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
        scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
      },
      confirmedLogin: {
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        metadata: {},
        methods: [
          AuthenticationMethod.EMAIL,
          AuthenticationMethod.PHONE,
          AuthenticationMethod.SESSION_LINK,
        ],
        remember: false,
        sso: false,
      },
      refreshSessionId: "052ef2f3-01d8-4e0c-9c3c-8daae8a8e541",
      browserSessionId: "52f23e8f-68c5-4c17-b6cf-05b17d3de8f5",
    });

    client = createTestClient();
  });

  test("should resolve created refresh session on missing session", async () => {
    authorizationSession.refreshSessionId = null;

    await expect(
      getUpdatedRefreshSession(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        expires: new Date("2021-01-01T08:01:39.000Z"),
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "phone", "session_link"],
        scopes: ["openid", "profile"],
      }),
    );
  });

  test("should resolve default config expiry", async () => {
    authorizationSession.refreshSessionId = null;
    client.expiry.refreshToken = null;

    await expect(
      getUpdatedRefreshSession(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        expires: new Date("2021-01-31T08:00:00.000Z"),
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "phone", "session_link"],
        scopes: ["openid", "profile"],
      }),
    );
  });

  test("should resolve created refresh session on mismatched identity", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValueOnce(
      createTestRefreshSession({
        identityId: "be83d954-ae47-49e4-90a3-b3fedc5f8bff",
      }),
    );

    await expect(
      getUpdatedRefreshSession(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2021-01-01T08:01:39.000Z"),
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
      }),
    );
  });

  test("should resolve updated refresh session", async () => {
    ctx.repository.refreshSessionRepository.find.mockResolvedValueOnce(
      createTestRefreshSession({
        audiences: ["0711b0ea-dd30-457c-b73c-92283762ef55"],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
        levelOfAssurance: 1,
        methods: [AuthenticationMethod.PASSWORD],
        scopes: [OpenIdScope.OPENID, OpenIdScope.PROFILE],
      }),
    );

    await expect(
      getUpdatedRefreshSession(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: [
          "0711b0ea-dd30-457c-b73c-92283762ef55",
          "6c04e67f-7911-4692-ab3b-f7b3f3178a40",
          "968db71c-3ea5-446a-a38e-cf614ec3168c",
        ],
        expires: new Date("2021-01-01T08:01:39.000Z"),
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "password", "phone", "session_link"],
      }),
    );
  });

  test("should keep immutable values once set", async () => {
    authorizationSession.confirmedLogin.levelOfAssurance = 1;

    ctx.repository.refreshSessionRepository.find.mockResolvedValueOnce(
      createTestRefreshSession({
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: [AuthenticationMethod.PASSWORD],
      }),
    );

    await expect(
      getUpdatedRefreshSession(ctx, authorizationSession, client),
    ).resolves.toStrictEqual(expect.any(RefreshSession));

    expect(ctx.repository.refreshSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["email", "password", "phone", "session_link"],
      }),
    );
  });
});
