import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
  setupIntegration,
  getTestClientCredentials,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/sessions", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(createTestClient({ type: "confidential" }));

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const session1 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        clients: [client.id],
        identityId,
        levelOfAssurance: 1,
      }),
    );

    const session2 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        clients: [client.id],
        identityId,
        levelOfAssurance: 2,
      }),
    );

    const session3 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        identityId,
        levelOfAssurance: 3,
      }),
    );

    const session4 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        identityId,
        levelOfAssurance: 4,
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/identities/${identityId}/sessions`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      sessions: [
        {
          id: session1.id,
          adjusted_access_level: 1,
          level_of_assurance: 1,
        },
        {
          id: session2.id,
          adjusted_access_level: 2,
          level_of_assurance: 2,
        },
        {
          id: session3.id,
          adjusted_access_level: 3,
          level_of_assurance: 3,
        },
        {
          id: session4.id,
          adjusted_access_level: 4,
          level_of_assurance: 4,
        },
      ],
    });
  });
});
