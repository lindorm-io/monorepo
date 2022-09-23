import MockDate from "mockdate";
import request from "supertest";
import { DisplayMode, PromptMode, ResponseMode, ResponseType, Scope } from "../../common";
import { baseHash, createURL } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { createTestClient } from "../../fixtures/entity";
import { getTestData } from "../../fixtures/data";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  getTestIdToken,
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/authorize", () => {
  beforeAll(setupIntegration);

  test("should resolve", async () => {
    const { codeChallenge, codeChallengeMethod, nonce, state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const identityId = randomUUID();
    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      subject: identityId,
    });

    const redirectData = baseHash(JSON.stringify({ string: "string", number: 123, boolean: true }));

    const url = createURL("/oauth2/authorize", {
      host: "https://rm.rm",
      query: {
        acrValues: ["loa_3", "session", "email", "phone"],
        amrValues: ["session", "email", "phone"],
        authToken: "auth.jwt.jwt",
        clientId: client.id,
        codeChallenge,
        codeChallengeMethod,
        display: DisplayMode.PAGE,
        idTokenHint: idToken,
        loginHint: "test@lindorm.io",
        maxAge: 3600,
        nonce,
        prompt: [PromptMode.LOGIN, PromptMode.CONSENT],
        redirectData,
        redirectUri: "https://test.client.lindorm.io/redirect",
        responseMode: ResponseMode.FRAGMENT,
        responseType: [ResponseType.CODE, ResponseType.TOKEN],
        scope: [
          Scope.ADDRESS,
          Scope.EMAIL,
          Scope.OFFLINE_ACCESS,
          Scope.OPENID,
          Scope.PHONE,
          Scope.PROFILE,
        ],
        state,
        uiLocales: ["sv-SE", "en-GB"],
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/login");
    expect(location.searchParams.get("session_id")).toStrictEqual(expect.any(String));

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.find({
      id: location.searchParams.get("session_id"),
    });

    expect(authorizationSession).toStrictEqual(
      expect.objectContaining({
        id: authorizationSession.id,
        authToken: "auth.jwt.jwt",
        clientId: client.id,
        code: {
          codeChallenge: codeChallenge,
          codeChallengeMethod: "S256",
        },
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          acrValues: [],
          amrValues: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          remember: false,
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: idToken,
        identifiers: {
          browserSessionId: null,
          consentSessionId: null,
          refreshSessionId: null,
        },
        loginHint: ["+46705498721", "email@lindorm.io", "identity_username", "test@lindorm.io"],
        maxAge: 3600,
        nonce: nonce,
        originalUri: expect.any(String),
        promptModes: ["login", "consent"],
        redirectData: "eyJzdHJpbmciOiJzdHJpbmciLCJudW1iZXIiOjEyMywiYm9vbGVhbiI6dHJ1ZX0=",
        redirectUri: "https://test.client.lindorm.io/redirect",
        requestedConsent: {
          audiences: expect.arrayContaining(["6ea68f3d-e31e-4882-85a5-0a617f431fdd", client.id]),
          scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        },
        requestedLogin: {
          identityId: identityId,
          minimumLevel: 3,
          recommendedLevel: 3,
          recommendedMethods: ["email", "phone"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone", "session"],
        },
        responseMode: "fragment",
        responseTypes: ["code", "token"],
        state: authorizationSession.state,
        status: {
          consent: "pending",
          login: "pending",
        },
        uiLocales: ["sv-SE", "en-GB"],
      }),
    );
  });
});
