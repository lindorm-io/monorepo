import { OpenIdScope } from "@lindorm-io/common-types";
import MockDate from "mockdate";
import request from "supertest";
import { createTestAuthorizationRequest, createTestClient } from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/consent", () => {
  beforeAll(setupIntegration);

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const authorizationRequest = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationRequest({
        requestedConsent: {
          audiences: [client.id],
          scopes: Object.values(OpenIdScope),
        },
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/consent/${authorizationRequest.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        audiences: authorizationRequest.requestedConsent.audiences,
        scopes: authorizationRequest.requestedConsent.scopes,
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/authorize/verify");
    expect(url.searchParams.get("session")).toBe(authorizationRequest.id);
    expect(url.searchParams.get("redirect_uri")).toBe(authorizationRequest.redirectUri);
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const authorizationRequest = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationRequest({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/consent/${authorizationRequest.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("consent_rejected");
    expect(url.searchParams.get("state")).toBe(authorizationRequest.state);
  });
});
