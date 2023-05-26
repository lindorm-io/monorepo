import MockDate from "mockdate";
import request from "supertest";
import {
  createTestAuthenticationTokenSession,
  createTestClient,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_AUTHENTICATION_TOKEN_SESSION_CACHE,
  TEST_CLIENT_REPOSITORY,
  TEST_TENANT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/authentication-token", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const authenticationTokenSession = await TEST_AUTHENTICATION_TOKEN_SESSION_CACHE.create(
      createTestAuthenticationTokenSession({
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .get(`/admin/sessions/authentication-token/${authenticationTokenSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      authentication_token_session: {
        id: authenticationTokenSession.id,
        audiences: [expect.any(String)],
        expires: "2021-01-02T08:00:00.000Z",
        metadata: {
          ip: "192.168.0.1",
          platform: "iOS",
        },
        scopes: ["openid", "profile"],
        token: expect.any(String),
      },

      client: {
        id: client.id,
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        single_sign_on: true,
        type: "confidential",
      },

      tenant: {
        id: tenant.id,
        name: "TenantName",
      },
    });
  });
});
