import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createURL, getRandomString } from "@lindorm-io/core";
import { createTestOidcSession } from "../fixtures/entity";
import { server } from "../server/server";
import {
  getTestGoogleIdToken,
  setupIntegration,
  TEST_OIDC_SESSION_CACHE,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/callback", () => {
  beforeAll(setupIntegration);

  nock("https://apple.com")
    .post("/token")
    .reply(200, { access_token: "access.token.with-signature" });

  nock("https://apple.com")
    .get("/userinfo")
    .reply(200, { sub: "1338eadb-0a29-47a7-bb67-90545fc8da52", given_name: "given" });

  nock("https://microsoft.com")
    .get("/userinfo")
    .reply(200, { sub: "e4e86779-3202-4464-899a-6da8487526bb", given_name: "given" });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://identity.test.lindorm.io")
    .post("/internal/identifiers/authenticate")
    .times(999)
    .reply(200, {
      identity_id: "30340f34-6520-46a5-bc77-ee1346145903",
    });

  nock("https://identity.test.lindorm.io")
    .put("/internal/userinfo/30340f34-6520-46a5-bc77-ee1346145903")
    .times(999)
    .reply(200);

  test("GET / - code", async () => {
    const oidcSession = await TEST_OIDC_SESSION_CACHE.create(
      createTestOidcSession({
        provider: "apple",
        nonce: getRandomString(16),
        state: getRandomString(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        code: "0f3cab9cf2d94c4280a8677366f0863c",
        state: oidcSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oidc/callback");
    expect(location.searchParams.get("session_id")).toBe(oidcSession.id);

    await expect(TEST_OIDC_SESSION_CACHE.find({ id: oidcSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });

  test("GET / - id_token", async () => {
    const oidcSession = await TEST_OIDC_SESSION_CACHE.create(
      createTestOidcSession({
        provider: "google",
        nonce: getRandomString(16),
        state: getRandomString(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        id_token: getTestGoogleIdToken({ nonce: oidcSession.nonce }),
        state: oidcSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oidc/callback");
    expect(location.searchParams.get("session_id")).toBe(oidcSession.id);

    await expect(TEST_OIDC_SESSION_CACHE.find({ id: oidcSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });

  test("GET / - token", async () => {
    const oidcSession = await TEST_OIDC_SESSION_CACHE.create(
      createTestOidcSession({
        provider: "microsoft",
        nonce: getRandomString(16),
        state: getRandomString(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        token: "access.token.with-signature",
        state: oidcSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oidc/callback");
    expect(location.searchParams.get("session_id")).toBe(oidcSession.id);

    await expect(TEST_OIDC_SESSION_CACHE.find({ id: oidcSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });
});
