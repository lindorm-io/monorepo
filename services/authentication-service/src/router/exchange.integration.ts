import MockDate from "mockdate";
import request from "supertest";
import { createTestAuthenticationConfirmationToken } from "../fixtures/entity";
import {
  TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE,
  getTestClientCredentials,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2022-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/exchange", () => {
  beforeAll(setupIntegration);

  test("should exchange opaque authentication confirmation token", async () => {
    const authenticationConfirmationToken =
      await TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE.create(
        createTestAuthenticationConfirmationToken(),
      );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/exchange")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        token: authenticationConfirmationToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      expires_in: 60,
      token: expect.any(String),
    });
  });
});
