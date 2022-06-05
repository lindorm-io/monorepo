import MockDate from "mockdate";
import request from "supertest";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
  createTestRefreshSession,
} from "../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessioninfo", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const identityId = randomUUID();

    const client1 = await TEST_CLIENT_CACHE.create(
      createTestClient({
        name: "client1",
      }),
    );

    const client2 = await TEST_CLIENT_CACHE.create(
      createTestClient({
        name: "client2",
      }),
    );

    await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        clients: [client1.id],
        identityId,
      }),
    );

    await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client2.id,
        identityId,
      }),
    );

    await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        clientId: client1.id,
        identityId,
      }),
    );

    await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        clientId: client2.id,
        identityId,
      }),
    );

    const accessToken = await getTestAccessToken({
      subject: identityId,
    });

    const response = await request(server.callback())
      .get("/sessioninfo")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      browser_sessions: [
        {
          clients: [client1.id],
          expires: "2021-04-01T08:00:00.000Z",
          levelOfAssurance: 2,
          remember: true,
        },
      ],
      clients: [
        {
          description: "Client description",
          id: client1.id,
          name: "client1",
        },
        {
          description: "Client description",
          id: client2.id,
          name: "client2",
        },
      ],
      consent_sessions: [
        {
          clientId: client1.id,
          scopes: ["openid", "email", "profile"],
        },
        {
          clientId: client2.id,
          scopes: ["openid", "email", "profile"],
        },
      ],
      refresh_sessions: [
        {
          clientId: client2.id,
          expires: "2021-02-01T08:00:00.000Z",
          levelOfAssurance: 2,
        },
      ],
    });
  });
});
