import MockDate from "mockdate";
import request from "supertest";
import { randomUUID } from "crypto";
import { server } from "../../../server/server";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../../fixtures/entity";
import {
  setupIntegration,
  TEST_ARGON,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
} from "../../../fixtures/integration";
import { baseHash } from "@lindorm-io/core";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/revoke", () => {
  beforeAll(setupIntegration);

  test("should revoke access token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    await request(server.callback())
      .post("/oauth2/sessions/revoke")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        token: accessToken.token,
      })
      .expect(204);

    await expect(TEST_OPAQUE_TOKEN_CACHE.find({ id: accessToken.id })).rejects.toThrow();
  });

  test("should revoke refresh token", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        identityId: randomUUID(),
      }),
    );

    const refreshToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestRefreshToken({
        clientSessionId: clientSession.id,
      }),
    );

    await request(server.callback())
      .post("/oauth2/sessions/revoke")
      .send({
        client_id: client.id,
        client_secret: "secret",
        token: refreshToken.token,
      })
      .expect(204);

    await expect(TEST_OPAQUE_TOKEN_CACHE.find({ id: refreshToken.id })).rejects.toThrow();
  });
});
