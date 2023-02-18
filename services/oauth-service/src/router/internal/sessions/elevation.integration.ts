import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";
import {
  createTestAccessSession,
  createTestElevationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/elevation", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        audiences: ["6f49f573-1949-4173-aa0b-52cb6431e20c"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        requestedAuthentication: {
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone"],
        },

        accessSessionId: accessSession.id,
        browserSessionId: browserSession.id,
        clientId: client.id,
        nonce: "fQUsgtHGmWCwmCCZ",
        refreshSessionId: refreshSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/internal/sessions/elevation/${elevationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      elevation: {
        is_required: true,
        minimum_level: 2,
        recommended_level: 2,
        recommended_methods: ["email"],
        required_level: 3,
        required_methods: ["email", "phone"],
      },

      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      elevation_session: {
        authentication_hint: ["test@lindorm.io"],
        country: "se",
        display_mode: "page",
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        id_token_hint: "id.jwt.jwt",
        identity_id: elevationSession.identityId,
        nonce: "fQUsgtHGmWCwmCCZ",
        ui_locales: ["sv-SE", "en-GB"],
      },
    });
  });

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        clientId: client.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post(`/internal/sessions/elevation/${elevationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identity_id: elevationSession.identityId,
        level_of_assurance: 2,
        methods: ["email_otp", "phone_otp"],
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/elevate/verify");
    expect(url.searchParams.get("session")).toBe(elevationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(elevationSession.redirectUri);
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/elevation/${elevationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("elevation_rejected");
    expect(url.searchParams.get("state")).toBe(elevationSession.state);
  });
});
