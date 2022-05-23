import MockDate from "mockdate";
import request from "supertest";
import { InvalidToken } from "../../../entity";
import { getTestClient, getTestRefreshSession } from "../../../test/entity";
import { server } from "../../../server/server";
import { randomUUID } from "crypto";
import {
  TEST_CLIENT_CACHE,
  TEST_ARGON,
  getTestAccessToken,
  getTestRefreshToken,
  setupIntegration,
  TEST_INVALID_TOKEN_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
} from "../../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/revoke", () => {
  beforeAll(setupIntegration);

  test("POST / - ACCESS", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const tokenId = randomUUID();
    const token = getTestAccessToken({
      id: tokenId,
      audiences: [client.id],
    });

    await request(server.callback())
      .post("/oauth2/sessions/revoke")
      .send({
        client_id: client.id,
        client_secret: "secret",
        token,
      })
      .expect(204);

    await expect(TEST_INVALID_TOKEN_CACHE.find({ id: tokenId })).resolves.toStrictEqual(
      expect.any(InvalidToken),
    );
  });

  test("POST / - REFRESH", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        secret: await TEST_ARGON.encrypt("secret"),
      }),
    );

    const tokenId = randomUUID();

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      getTestRefreshSession({
        clientId: client.id,
        identityId: randomUUID(),
        tokenId,
      }),
    );

    const token = getTestRefreshToken({
      id: tokenId,
      audiences: [client.id],
      sessionId: refreshSession.id,
    });

    await request(server.callback())
      .post("/oauth2/sessions/revoke")
      .send({
        client_id: client.id,
        client_secret: "secret",
        token,
      })
      .expect(204);

    await expect(TEST_INVALID_TOKEN_CACHE.find({ id: tokenId })).resolves.toStrictEqual(
      expect.any(InvalidToken),
    );

    await expect(TEST_REFRESH_SESSION_REPOSITORY.find({ id: refreshSession.id })).rejects.toThrow();
  });
});
