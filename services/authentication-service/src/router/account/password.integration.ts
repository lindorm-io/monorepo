import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { CryptoLayered } from "@lindorm-io/crypto";
import { createTestAccount } from "../../fixtures/entity";
import { server } from "../../server/server";
import {
  TEST_ACCOUNT_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/account/password", () => {
  const salt =
    "84s8VNdOtIvwL6KvNd28YktehfPhwGy0xObf7c7yr6Vz3XwH3CA9aOi7rSYKhPICaTukA0qqSzVhm1WW1L48YvpYD9OLAaNFqSAy6VIdA3NF096aBoawvt2boQkHF5tC";

  const crypto = new CryptoLayered({
    aes: { secret: salt },
    sha: { secret: salt },
  });

  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://vault.test.lindorm.io")
    .get((uri) => uri.includes("/internal/vault"))
    .times(999)
    .reply(200, {
      data: {
        aes: salt,
        sha: salt,
      },
    });

  test("POST /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        password: null,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    await request(server.callback())
      .post("/account/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        new_password: "new-password",
      })
      .expect(204);

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert("new-password", found.password)).resolves.not.toThrow();
  });

  test("PATCH /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        password: await crypto.encrypt("password"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    await request(server.callback())
      .patch("/account/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        password: "password",
        new_password: "new-password",
      })
      .expect(204);

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert("new-password", found.password)).resolves.not.toThrow();
  });
});
