import MockDate from "mockdate";
import { confirmConsentController } from "./confirm-consent";
import { createAuthorizationVerifyRedirectUri as _createAuthorizationVerifyRedirectUri } from "../../util";
import {
  getTestAuthorizationSession,
  getTestBrowserSession,
  getTestConsentSession,
} from "../../test/entity";
import { logger } from "../../test/logger";
import { SessionStatus } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const createAuthorizationVerifyRedirectUri = _createAuthorizationVerifyRedirectUri as jest.Mock;

describe("confirmConsentController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: {
          update: jest.fn(),
        },
      },
      data: {
        audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
        scopes: ["address", "email", "offline_access", "openid", "phone", "private", "profile"],
      },
      entity: {
        authorizationSession: getTestAuthorizationSession({
          id: "49a746bf-eb34-41e8-ac8d-11716a5b76a1",
        }),
        browserSession: getTestBrowserSession({
          id: "8ecbb9dc-5952-4036-b95a-3219394cd2a6",
        }),
        consentSession: getTestConsentSession({
          audiences: [],
          scopes: [],
          sessions: [],
        }),
      },
      logger,
      repository: {
        consentSessionRepository: {
          update: jest.fn(),
        },
      },
    };

    createAuthorizationVerifyRedirectUri.mockImplementation(() => "redirect-uri");
  });

  test("should resolve", async () => {
    await expect(confirmConsentController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "redirect-uri" },
    });

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["711b142d-5e96-41a9-abb6-794e5c7464df"],
        scopes: ["address", "email", "offline_access", "openid", "phone", "private", "profile"],
        sessions: ["8ecbb9dc-5952-4036-b95a-3219394cd2a6"],
      }),
    );

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        consentStatus: SessionStatus.CONFIRMED,
      }),
    );
  });
});
