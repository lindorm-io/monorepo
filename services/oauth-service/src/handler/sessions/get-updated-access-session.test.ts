import MockDate from "mockdate";
import { AuthorizationSession, AccessSession } from "../../entity";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAuthorizationSession, createTestAccessSession } from "../../fixtures/entity";
import { getUpdatedAccessSession } from "./get-updated-access-session";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getUpdatedAccessSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      repository: {
        accessSessionRepository: createMockRepository((opts) =>
          createTestAccessSession({
            audiences: ["0711b0ea-dd30-457c-b73c-92283762ef55"],
            identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
            latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
            levelOfAssurance: 2,
            methods: ["email", "phone"],
            scopes: ["openid", "profile"],
            ...opts,
          }),
        ),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      confirmedConsent: {
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        scopes: ["openid", "profile"],
      },
      confirmedLogin: {
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "phone", "session_link"],
        remember: false,
        sso: false,
      },
      accessSessionId: "052ef2f3-01d8-4e0c-9c3c-8daae8a8e541",
      browserSessionId: "52f23e8f-68c5-4c17-b6cf-05b17d3de8f5",
    });
  });

  test("should resolve created access session on missing session", async () => {
    authorizationSession.accessSessionId = null;

    await expect(getUpdatedAccessSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["6c04e67f-7911-4692-ab3b-f7b3f3178a40", "968db71c-3ea5-446a-a38e-cf614ec3168c"],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "phone", "session_link"],
        scopes: ["openid", "profile"],
      }),
    );
  });

  test("should resolve created access session on mismatched identity", async () => {
    ctx.repository.accessSessionRepository.find.mockResolvedValueOnce(
      createTestAccessSession({
        identityId: "be83d954-ae47-49e4-90a3-b3fedc5f8bff",
      }),
    );

    await expect(getUpdatedAccessSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
      }),
    );
  });

  test("should resolve updated access session", async () => {
    ctx.repository.accessSessionRepository.find.mockResolvedValueOnce(
      createTestAccessSession({
        audiences: ["0711b0ea-dd30-457c-b73c-92283762ef55"],
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
        levelOfAssurance: 1,
        methods: ["password"],
        scopes: ["openid", "profile"],
      }),
    );

    await expect(getUpdatedAccessSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: [
          "0711b0ea-dd30-457c-b73c-92283762ef55",
          "6c04e67f-7911-4692-ab3b-f7b3f3178a40",
          "968db71c-3ea5-446a-a38e-cf614ec3168c",
        ],
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 3,
        methods: ["email", "password", "phone", "session_link"],
      }),
    );
  });

  test("should keep immutable values once set", async () => {
    authorizationSession.confirmedLogin.levelOfAssurance = 1;

    ctx.repository.accessSessionRepository.find.mockResolvedValueOnce(
      createTestAccessSession({
        identityId: "34a10f02-a5a8-40c5-a0be-63a9158f712e",
        latestAuthentication: new Date("2020-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["password"],
      }),
    );

    await expect(getUpdatedAccessSession(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(AccessSession),
    );

    expect(ctx.repository.accessSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["email", "password", "phone", "session_link"],
      }),
    );
  });
});
