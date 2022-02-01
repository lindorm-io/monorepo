import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { ClientType, SessionStatus } from "../../common";
import { getExpires } from "@lindorm-io/core";
import { oauthConsentController } from "./consent";
import {
  oauthConfirmConsent as _oauthConfirmConsent,
  oauthGetConsentInfo as _oauthGetConsentInfo,
  oauthSkipConsent as _oauthSkipConsent,
} from "../../handler";

MockDate.set("2020-01-01T08:00:15.000");

jest.mock("../../handler");

const oauthGetConsentInfo = _oauthGetConsentInfo as jest.Mock;
const oauthConfirmConsent = _oauthConfirmConsent as jest.Mock;
const oauthSkipConsent = _oauthSkipConsent as jest.Mock;

describe("oauthConsentController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        consentSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: { sessionId: "sessionId" },
      setCookie: jest.fn(),
    };

    const { expires, expiresIn } = getExpires(new Date("2022-01-01T08:00:00.000Z"));

    info = {
      authorizationSession: {
        displayMode: "displayMode",
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

    oauthGetConsentInfo.mockResolvedValue(info);
    oauthConfirmConsent.mockResolvedValue({ redirectTo: "oauthConfirmConsent" });
    oauthSkipConsent.mockResolvedValue({ redirectTo: "oauthSkipConsent" });
  });

  test("should resolve URL", async () => {
    await expect(oauthConsentController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(oauthConfirmConsent).not.toHaveBeenCalled();
    expect(oauthSkipConsent).not.toHaveBeenCalled();

    expect(ctx.cache.consentSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2022-01-01T08:00:00.000Z"),
      }),
      expect.any(Number),
    );
    expect(ctx.setCookie).toHaveBeenCalled();
  });

  test("should resolve skip", async () => {
    info.consentRequired = false;

    await expect(oauthConsentController(ctx)).resolves.toStrictEqual({
      redirect: "oauthSkipConsent",
    });

    expect(oauthSkipConsent).toHaveBeenCalled();
  });

  test("should resolve confirm", async () => {
    info.client.type = ClientType.CONFIDENTIAL;

    await expect(oauthConsentController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmConsent",
    });

    expect(oauthConfirmConsent).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    info.consentStatus = SessionStatus.CONFIRMED;

    await expect(oauthConsentController(ctx)).rejects.toThrow(ClientError);
  });
});
