import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { ClientType, SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestConsentSession } from "../../fixtures/entity";
import { getExpires } from "@lindorm-io/core";
import { initialiseConsentController } from "./initialise-consent";
import {
  confirmOauthConsentSession as _confirmOauthConsentSession,
  fetchOauthConsentInfo as _fetchOauthConsentInfo,
  skipOauthConsentSession as _skipOauthConsentSession,
} from "../../handler";

MockDate.set("2020-01-01T08:00:15.000");

jest.mock("../../handler");

const fetchOauthConsentInfo = _fetchOauthConsentInfo as jest.Mock;
const confirmOauthConsentSession = _confirmOauthConsentSession as jest.Mock;
const skipOauthConsentSession = _skipOauthConsentSession as jest.Mock;

describe("initialiseConsentController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        consentSessionCache: createMockCache(createTestConsentSession),
      },
      data: { sessionId: "7dad764a-a9e0-44d1-a724-b1d507d0f9f4" },
      setCookie: jest.fn(),
    };

    const { expires, expiresIn } = getExpires(new Date("2022-01-01T08:00:00.000Z"));

    info = {
      authorizationSession: {
        displayMode: "page",
        expiresAt: expires.toISOString(),
        expiresIn,
        uiLocales: ["en-GB"],
      },
      client: {
        scopeDescriptions: [{ scope: "scopeDescriptions" }],
        description: "description",
        name: "name",
        requiredScopes: ["scope"],
        type: ClientType.PUBLIC,
        logoUri: "logoUri",
      },
      consentRequired: true,
      consentStatus: SessionStatus.PENDING,
      requested: {
        audiences: ["audience"],
        scopes: ["scope"],
      },
    };

    fetchOauthConsentInfo.mockResolvedValue(info);
    confirmOauthConsentSession.mockResolvedValue({ redirectTo: "https://confirm" });
    skipOauthConsentSession.mockResolvedValue({ redirectTo: "https://skip" });
  });

  test("should resolve URL", async () => {
    await expect(initialiseConsentController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(confirmOauthConsentSession).not.toHaveBeenCalled();
    expect(skipOauthConsentSession).not.toHaveBeenCalled();

    expect(ctx.cache.consentSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2022-01-01T08:00:00.000Z"),
      }),
    );
    expect(ctx.setCookie).toHaveBeenCalled();
  });

  test("should resolve skip", async () => {
    info.consentRequired = false;

    await expect(initialiseConsentController(ctx)).resolves.toStrictEqual({
      redirect: "https://skip",
    });

    expect(skipOauthConsentSession).toHaveBeenCalled();
  });

  test("should resolve confirm", async () => {
    info.client.type = ClientType.CONFIDENTIAL;

    await expect(initialiseConsentController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });

    expect(confirmOauthConsentSession).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    info.consentStatus = SessionStatus.CONFIRMED;

    await expect(initialiseConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
