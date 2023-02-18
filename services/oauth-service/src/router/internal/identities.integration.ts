import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/sessions", async () => {
    const identityId = randomUUID();

    const client1 = await TEST_CLIENT_REPOSITORY.create(createTestClient({ type: "confidential" }));
    const client2 = await TEST_CLIENT_REPOSITORY.create(createTestClient({ type: "confidential" }));

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

    const access1 = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        clientId: client1.id,
        browserSessionId: browser1.id,
        identityId,
        levelOfAssurance: 3,
      }),
    );

    const access2 = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        clientId: client2.id,
        browserSessionId: browser1.id,
        identityId,
        levelOfAssurance: 4,
      }),
    );

    const refresh1 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client1.id,
        browserSessionId: browser1.id,
        identityId,
        levelOfAssurance: 1,
      }),
    );

    const refresh2 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client2.id,
        browserSessionId: browser2.id,
        identityId,
        levelOfAssurance: 2,
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/identities/${identityId}/sessions`)
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
        },
        {
          adjusted_access_level: 2,
          id: refresh2.id,
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
          type: "refresh",
        },
        {
          adjusted_access_level: 3,
          id: access1.id,
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 3,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
          type: "access",
        },
        {
          adjusted_access_level: 4,
          id: access2.id,
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 4,
          methods: ["email", "phone"],
          scopes: ["openid", "profile"],
          type: "access",
        },
      ],
    });
  });
});
