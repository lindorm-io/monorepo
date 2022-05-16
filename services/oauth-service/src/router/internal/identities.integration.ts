import MockDate from "mockdate";
import request from "supertest";
import { ClientType } from "../../common";
import { server } from "../../server/server";
import { randomUUID } from "crypto";
import { getTestBrowserSession, getTestClient, getTestRefreshSession } from "../../test/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
  setupIntegration,
  getTestClientCredentials,
} from "../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/internal/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id/sessions", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const session1 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        clients: [client.id],
        identityId,
        levelOfAssurance: 1,
      }),
    );

    const session2 = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        clients: [client.id],
        identityId,
        levelOfAssurance: 2,
      }),
    );

    const session3 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      getTestRefreshSession({
        clientId: client.id,
        identityId,
        levelOfAssurance: 3,
      }),
    );

    const session4 = await TEST_REFRESH_SESSION_REPOSITORY.create(
      getTestRefreshSession({
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
          levelOfAssurance: 1,
        },
        {
          id: session2.id,
          levelOfAssurance: 2,
        },
        {
          id: session3.id,
          levelOfAssurance: 3,
        },
        {
          id: session4.id,
          levelOfAssurance: 4,
        },
      ],
    });
  });
});
