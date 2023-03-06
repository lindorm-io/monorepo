import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import { OpenIdClientType } from "@lindorm-io/common-types";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestTenant,
} from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_TENANT_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/sessions", async () => {
    const identityId = randomUUID();

    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client1 = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        tenantId: tenant.id,
        type: OpenIdClientType.CONFIDENTIAL,
      }),
    );
    const client2 = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        tenantId: tenant.id,
        type: OpenIdClientType.PUBLIC,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client1.id],
      subject: client1.id,
    });

    const browser1 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        identityId,
        levelOfAssurance: 1,
      }),
    );

    const browser2 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        identityId,
        levelOfAssurance: 2,
      }),
    );

    const refresh1 = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client1.id,
        browserSessionId: browser1.id,
        identityId,
        levelOfAssurance: 1,
      }),
    );

    const refresh2 = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client2.id,
        browserSessionId: browser2.id,
        identityId,
        levelOfAssurance: 2,
      }),
    );

    const response = await request(server.callback())
      .get(`/admin/identities/${identityId}/sessions`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      sessions: [
        {
          adjusted_access_level: 1,
          id: refresh1.id,
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 1,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
          type: "refresh",
          metadata: {
            device_name: "Test Device",
            ip: "10.0.0.1",
            platform: "iOS",
          },

          client: {
            id: client1.id,
            logo_uri: "https://logo.uri/logo",
            name: "ClientName",
            type: "confidential",
          },

          tenant: {
            id: tenant.id,
            name: "TenantName",
          },
        },
        {
          adjusted_access_level: 2,
          id: refresh2.id,
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
          type: "refresh",
          metadata: {
            device_name: "Test Device",
            ip: "10.0.0.1",
            platform: "iOS",
          },

          client: {
            id: client2.id,
            logo_uri: "https://logo.uri/logo",
            name: "ClientName",
            type: "public",
          },

          tenant: {
            id: tenant.id,
            name: "TenantName",
          },
        },
      ],
    });
  });
});
