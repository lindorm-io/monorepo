import { AuthenticationMethod } from "@lindorm-io/common-types";
import MockDate from "mockdate";
import request from "supertest";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestElevationRequest,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_TENANT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/elevation", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const elevationRequest = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationRequest({
        requestedAuthentication: {
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: [AuthenticationMethod.EMAIL],
          requiredLevel: 3,
          requiredMethods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
        },

        browserSessionId: browserSession.id,
        clientId: client.id,
        nonce: "fQUsgtHGmWCwmCCZ",
        clientSessionId: clientSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/admin/sessions/elevation/${elevationRequest.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      elevation: {
        is_required: true,
        status: "pending",

        minimum_level: 2,
        recommended_level: 2,
        recommended_methods: [AuthenticationMethod.EMAIL],
        required_level: 3,
        required_methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      },

      elevation_request: {
        id: elevationRequest.id,
        authentication_hint: ["test@lindorm.io"],
        country: "se",
        display_mode: "page",
        expires: "2021-01-02T08:00:00.000Z",
        id_token_hint: "id.jwt.jwt",
        identity_id: elevationRequest.identityId,
        nonce: "fQUsgtHGmWCwmCCZ",
        ui_locales: ["sv-SE", "en-GB"],
      },

      client: {
        id: client.id,
        name: "ClientName",
        logo_uri: "https://logo.uri/logo",
        single_sign_on: true,
        type: "confidential",
      },

      tenant: {
        id: tenant.id,
        name: "TenantName",
      },
    });
  });

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const elevationRequest = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationRequest({
        clientId: client.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post(`/admin/sessions/elevation/${elevationRequest.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identity_id: elevationRequest.identityId,
        level_of_assurance: 2,
        methods: ["email_otp", "phone_otp"],
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/elevate/verify");
    expect(url.searchParams.get("session")).toBe(elevationRequest.id);
    expect(url.searchParams.get("redirect_uri")).toBe(elevationRequest.redirectUri);
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const elevationRequest = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationRequest({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/elevation/${elevationRequest.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("elevation_rejected");
    expect(url.searchParams.get("state")).toBe(elevationRequest.state);
  });
});
