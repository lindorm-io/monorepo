import MockDate from "mockdate";
import request from "supertest";
import { baseHash } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { createTestClient } from "../../fixtures/entity";
import { getTestData } from "../../fixtures/data";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  getTestIdToken,
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/authorize", () => {
  beforeAll(setupIntegration);

  test("should resolve", async () => {
    const { codeChallenge, codeChallengeMethod, nonce, state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

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

    const response = await request(server.callback())
      .get("/oauth2/authorize")
      .query({
        acr_values: ["loa_3", "session", "email", "phone"].join(" "),
        amr_values: ["session", "email", "phone"].join(" "),
        auth_token: "auth.jwt.jwt",
        client_id: client.id,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        display: "page",
        id_token_hint: idToken,
        login_hint: "test@lindorm.io",
        max_age: 3600,
        nonce,
        prompt: ["login", "consent"].join(" "),
        redirect_data: redirectData,
        redirect_uri: "https://test.client.lindorm.io/redirect",
        response_mode: "fragment",
        response_type: ["code", "token"].join(" "),
        scope: ["address", "email", "offline_access", "openid", "phone", "profile"].join(" "),
        state,
        ui_locales: ["sv-SE", "en-GB"].join(" "),
      })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/login");
    expect(location.searchParams.get("session")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("display")).toBe("page");
    expect(location.searchParams.get("locales")).toBe("sv-SE en-GB");

    await expect(
      TEST_AUTHORIZATION_SESSION_CACHE.find({
        id: location.searchParams.get("session")!,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        accessSessionId: null,
        authToken: "auth.jwt.jwt",
        browserSessionId: null,
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
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          sso: false,
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: idToken,
        loginHint: ["+46705498721", "email@lindorm.io", "identity_username", "test@lindorm.io"],
        maxAge: 3600,
        nonce: nonce,
        originalUri: expect.any(String),
        promptModes: ["login", "consent"],
        redirectData: "eyJzdHJpbmciOiJzdHJpbmciLCJudW1iZXIiOjEyMywiYm9vbGVhbiI6dHJ1ZX0=",
        redirectUri: "https://test.client.lindorm.io/redirect",
        refreshSessionId: null,
        requestedConsent: {
          audiences: expect.arrayContaining([configuration.oauth.client_id, client.id]),
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
        requestedSelectAccount: {
          browserSessions: [],
        },
        responseMode: "fragment",
        responseTypes: ["code", "token"],
        revision: 0,
        state: state,
        status: {
          consent: "pending",
          login: "pending",
          selectAccount: "skip",
        },
        uiLocales: ["sv-SE", "en-GB"],
      }),
    );
  });
});
