import MockDate from "mockdate";
import request from "supertest";
import { server } from "../server/server";
import { randomUUID } from "crypto";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../fixtures/entity";
import {
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
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

    const client1 = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        id: "991187c9-ee8e-42c4-8763-2c570489be25",
        name: "client1",
      }),
    );

    const client2 = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        id: "e2b6a09d-5e75-4bb3-b784-34b78dba6d45",
        name: "client2",
      }),
    );

    await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        id: "bb007a25-a77e-4286-8953-37bc47554f8a",
        identityId,
      }),
    );

    await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        id: "59a862da-8188-41d6-8c72-329b30ce8e42",
        clientId: client2.id,
        identityId,
      }),
    );

    await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        id: "7ef9b009-a400-4af7-bfdd-d155f58d21ad",
        clientId: client1.id,
        identityId,
      }),
    );

    await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        id: "98823ace-1c47-4293-bb50-050d21f884e0",
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
      access_sessions: [
        {
          id: "7ef9b009-a400-4af7-bfdd-d155f58d21ad",
          client_id: "991187c9-ee8e-42c4-8763-2c570489be25",
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          scopes: ["openid", "profile"],
        },
        {
          id: "98823ace-1c47-4293-bb50-050d21f884e0",
          client_id: "e2b6a09d-5e75-4bb3-b784-34b78dba6d45",
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          scopes: ["openid", "profile"],
        },
      ],
      browser_sessions: [
        {
          id: "bb007a25-a77e-4286-8953-37bc47554f8a",
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          remember: true,
        },
      ],
      clients: [
        {
          id: "991187c9-ee8e-42c4-8763-2c570489be25",
          description: "Client description",
          name: "client1",
        },
        {
          id: "e2b6a09d-5e75-4bb3-b784-34b78dba6d45",
          description: "Client description",
          name: "client2",
        },
      ],
      refresh_sessions: [
        {
          id: "59a862da-8188-41d6-8c72-329b30ce8e42",
          client_id: "e2b6a09d-5e75-4bb3-b784-34b78dba6d45",
          expires: "2021-02-01T08:00:00.000Z",
          latest_authentication: "2021-01-01T07:59:00.000Z",
          level_of_assurance: 2,
          scopes: ["openid", "profile"],
        },
      ],
    });
  });
});
