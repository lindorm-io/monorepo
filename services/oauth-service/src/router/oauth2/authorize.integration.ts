import MockDate from "mockdate";
import request from "supertest";
import { baseHash } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
import { createTestClient } from "../../fixtures/entity";
import { createURL } from "@lindorm-io/url";
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
        display: "page",
        idTokenHint: idToken,
        loginHint: "test@lindorm.io",
        maxAge: 3600,
        nonce,
        prompt: ["login", "consent"],
        redirectData,
        redirectUri: "https://test.client.lindorm.io/redirect",
        responseMode: "fragment",
        responseType: ["code", "token"],
        scope: ["address", "email", "offline_access", "openid", "phone", "profile"],
        state,
        uiLocales: ["sv-SE", "en-GB"],
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://rm.rm", ""))
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
        originalUri: url.replace("https://rm.rm", "https://oauth.test.lindorm.io"),
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
