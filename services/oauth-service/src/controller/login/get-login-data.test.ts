import MockDate from "mockdate";
import { getLoginDataController } from "./get-login-data";
import { isLoginRequired as _isLoginRequired } from "../../util";
import { createMockRepository } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";
import { AuthorizationSession, BrowserSession, Client } from "../../entity";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

const isLoginRequired = _isLoginRequired as jest.Mock;

describe("getLoginInfoController", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;
  let browserSession: BrowserSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      identifiers: {
        browserSessionId: randomUUID(),
        consentSessionId: null,
        refreshSessionId: null,
      },
    });
    browserSession = createTestBrowserSession({
      id: authorizationSession.identifiers.browserSessionId!,
    });
    client = createTestClient();

    ctx = {
      entity: {
        authorizationSession,
        client,
      },
      repository: { browserSessionRepository: createMockRepository(() => browserSession) },
    };

    isLoginRequired.mockImplementation(() => true);
  });

  test("should resolve", async () => {
    await expect(getLoginDataController(ctx)).resolves.toStrictEqual({
      body: {
        authorizationSession: {
          id: authorizationSession.id,
          authToken: "auth.jwt.jwt",
          country: "se",
          displayMode: "popup",
          expiresAt: "2021-01-02T08:00:00.000Z",
          expiresIn: 86400,
          loginHint: ["test@lindorm.io"],
          nonce: authorizationSession.nonce,
          originalUri: "https://localhost/oauth2/authorize?query=query",
          promptModes: ["login", "consent"],
          uiLocales: ["sv-SE", "en-GB"],
        },
        browserSession: {
          amrValues: ["email", "phone"],
          country: "se",
          identityId: browserSession.identityId,
          levelOfAssurance: 2,
          remember: true,
        },
        client: {
          description: "Client description",
          logoUri: "https://logo.uri/logo",
          name: "ClientName",
          type: "confidential",
        },
        loginRequired: true,
        loginStatus: "pending",
        requested: {
          identityId: authorizationSession.requestedLogin.identityId,
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone"],
        },
      },
    });
  });
});
