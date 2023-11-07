import { randomHex } from "@lindorm-io/random";
import { createURL } from "@lindorm-io/url";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestFederationSession } from "../fixtures/entity";
import {
  TEST_FEDERATION_SESSION_CACHE,
  getTestGoogleIdToken,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

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
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://identity.test.lindorm.io").post("/admin/identifiers").times(999).reply(204);

  nock("https://identity.test.lindorm.io").get("/admin/find").query(true).times(999).reply(200, {
    identity_id: "30340f34-6520-46a5-bc77-ee1346145903",
  });

  nock("https://identity.test.lindorm.io")
    .put((uri) => uri.startsWith("/admin/userinfo/"))
    .times(999)
    .reply(204);

  test("GET / - code", async () => {
    const federationSession = await TEST_FEDERATION_SESSION_CACHE.create(
      createTestFederationSession({
        identityId: null,
        nonce: randomHex(16),
        provider: "apple",
        state: randomHex(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        code: "0f3cab9cf2d94c4280a8677366f0863c",
        state: federationSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/federation/callback");
    expect(location.searchParams.get("session")).toBe(federationSession.id);

    await expect(
      TEST_FEDERATION_SESSION_CACHE.find({ id: federationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });

  test("GET / - id_token", async () => {
    const federationSession = await TEST_FEDERATION_SESSION_CACHE.create(
      createTestFederationSession({
        identityId: null,
        nonce: randomHex(16),
        provider: "google",
        state: randomHex(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        id_token: getTestGoogleIdToken({ nonce: federationSession.nonce! }),
        state: federationSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/federation/callback");
    expect(location.searchParams.get("session")).toBe(federationSession.id);

    await expect(
      TEST_FEDERATION_SESSION_CACHE.find({ id: federationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });

  test("GET / - token", async () => {
    const federationSession = await TEST_FEDERATION_SESSION_CACHE.create(
      createTestFederationSession({
        identityId: null,
        nonce: randomHex(16),
        provider: "microsoft",
        state: randomHex(48),
      }),
    );

    const url = createURL("/callback", {
      host: "https://test.test",
      query: {
        token: "access.token.with-signature",
        state: federationSession.state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/federation/callback");
    expect(location.searchParams.get("session")).toBe(federationSession.id);

    await expect(
      TEST_FEDERATION_SESSION_CACHE.find({ id: federationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identityId: "30340f34-6520-46a5-bc77-ee1346145903",
        verified: true,
      }),
    );
  });
});
