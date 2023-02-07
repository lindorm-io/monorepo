import { createMockRepository } from "@lindorm-io/mongo";
import { AuthorizationSession, BrowserSession, ConsentSession } from "../../entity";
import { getUpdatedConsentSession } from "./get-updated-consent-session";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { ServerError } from "@lindorm-io/errors";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestConsentSession,
} from "../../fixtures/entity";

describe("getUpdatedConsentSession", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;

  beforeEach(() => {
    ctx = {
      repository: {
        consentSessionRepository: createMockRepository((opts) =>
          createTestConsentSession({
            audiences: ["a5c35a6d-56aa-4517-8f74-47a3618dcd38"],
            scopes: ["phone", "offline_access"],
            sessions: ["be632c33-b9d0-498e-89c0-f58117c7ce1d"],
            ...opts,
          }),
        ),
      },
    };

    authorizationSession = createTestAuthorizationSession({
      clientId: "f5d7dea4-5709-498f-93a8-bb14048d99d7",
      confirmedConsent: {
        audiences: ["f5d7dea4-5709-498f-93a8-bb14048d99d7", "a55ac558-4422-439b-94e8-f4a36b704839"],
        scopes: ["openid", "email", "profile"],
      },
    });
    browserSession = createTestBrowserSession({
      id: "188da475-fe01-42dd-9d8e-9a99d347abfe",
      identityId: "ab617090-d98a-40fd-999c-a999cb9f298e",
    });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve skipped consent session", async () => {
    authorizationSession.status.consent = "skip";

    await expect(
      getUpdatedConsentSession(ctx, authorizationSession, browserSession),
    ).resolves.toStrictEqual(expect.any(ConsentSession));

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["a5c35a6d-56aa-4517-8f74-47a3618dcd38"],
        scopes: ["phone", "offline_access"],
        sessions: expect.arrayContaining([
          "188da475-fe01-42dd-9d8e-9a99d347abfe",
          "be632c33-b9d0-498e-89c0-f58117c7ce1d",
        ]),
      }),
    );
  });

  test("should resolve updated consent session", async () => {
    await expect(
      getUpdatedConsentSession(ctx, authorizationSession, browserSession),
    ).resolves.toStrictEqual(expect.any(ConsentSession));

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: expect.arrayContaining([
          "a55ac558-4422-439b-94e8-f4a36b704839",
          "a5c35a6d-56aa-4517-8f74-47a3618dcd38",
          "f5d7dea4-5709-498f-93a8-bb14048d99d7",
        ]),
        clientId: "f5d7dea4-5709-498f-93a8-bb14048d99d7",
        identityId: "ab617090-d98a-40fd-999c-a999cb9f298e",
        scopes: expect.arrayContaining(["email", "offline_access", "openid", "phone", "profile"]),
        sessions: expect.arrayContaining([
          "188da475-fe01-42dd-9d8e-9a99d347abfe",
          "be632c33-b9d0-498e-89c0-f58117c7ce1d",
        ]),
      }),
    );
  });

  test("should resolve created consent session", async () => {
    ctx.repository.consentSessionRepository.find.mockRejectedValue(
      new EntityNotFoundError("message"),
    );

    await expect(
      getUpdatedConsentSession(ctx, authorizationSession, browserSession),
    ).resolves.toStrictEqual(expect.any(ConsentSession));

    expect(ctx.repository.consentSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["a55ac558-4422-439b-94e8-f4a36b704839", "f5d7dea4-5709-498f-93a8-bb14048d99d7"],
        clientId: "f5d7dea4-5709-498f-93a8-bb14048d99d7",
        identityId: "ab617090-d98a-40fd-999c-a999cb9f298e",
        scopes: ["email", "openid", "profile"],
        sessions: ["188da475-fe01-42dd-9d8e-9a99d347abfe"],
      }),
    );
  });

  test("should throw on invalid confirmation data", async () => {
    authorizationSession.confirmedConsent.audiences = [];

    await expect(
      getUpdatedConsentSession(ctx, authorizationSession, browserSession),
    ).rejects.toThrow(ServerError);
  });
});
