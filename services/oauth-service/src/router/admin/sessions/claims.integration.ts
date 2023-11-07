import MockDate from "mockdate";
import request from "supertest";
import {
  createTestClaimsSession,
  createTestClient,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_CLAIMS_SESSION_CACHE,
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

describe("/admin/sessions/claims", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const claimsSession = await TEST_CLAIMS_SESSION_CACHE.create(
      createTestClaimsSession({
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .get(`/admin/sessions/claims/${claimsSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      claims_session: {
        id: claimsSession.id,
        adjusted_access_level: 2,
        audiences: [expect.any(String)],
        expires: "2021-01-02T08:00:00.000Z",
        factors: ["urn:lindorm:auth:acr:2fa"],
        identity_id: expect.any(String),
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        metadata: {
          ip: "192.168.0.1",
          platform: "iOS",
        },
        methods: ["urn:lindorm:auth:method:email", "urn:lindorm:auth:method:phone"],
        scopes: ["openid", "profile"],
        strategies: ["urn:lindorm:auth:strategy:email-code", "urn:lindorm:auth:strategy:phone-otp"],
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
