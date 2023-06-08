import { createOpaqueToken } from "@lindorm-io/jwt";
import jwt from "jsonwebtoken";
import MockDate from "mockdate";
import request from "supertest";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import {
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/exchange", () => {
  beforeAll(setupIntegration);

  test("should exchange opaque access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        tenantId: client.tenantId,
      }),
    );

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
      tenant: client.tenantId,
    });

    const response = await request(server.callback())
      .post("/admin/exchange")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: opaqueToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      expires_in: 86400,
      token: expect.any(String),
    });

    expect(jwt.decode(response.body.token)).toStrictEqual({
      aal: 2,
      aud: clientSession.audiences,
      auth_time: 1609487940,
      azp: client.id,
      cid: client.id,
      exp: 1609574400,
      iat: 1609488000,
      iss: "https://oauth.test.lindorm.io",
      jti: expect.any(String),
      loa: 2,
      nbf: 1609488000,
      nonce: clientSession.nonce,
      scope: "openid profile",
      sid: clientSession.id,
      sih: "refresh",
      sub: clientSession.identityId,
      suh: "identity",
      tid: client.tenantId,
      token_type: "access_token",
    });
  });
});
