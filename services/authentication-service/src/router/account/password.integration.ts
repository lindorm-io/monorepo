import { CryptoLayered } from "@lindorm-io/crypto";
import { randomBytes } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestAccount } from "../../fixtures/entity";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_ACCOUNT_REPOSITORY,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/account/password", () => {
  const secret = randomBytes(16).toString("hex");
  const crypto = new CryptoLayered({
    aes: { secret },
    hmac: { secret },
  });

  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://vault.test.lindorm.io")
    .get((uri) => uri.includes("/admin/vault"))
    .times(999)
    .reply(200, {
      data: {
        aes: secret,
        hmac: secret,
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

    await expect(crypto.assert("new-password", found.password!)).resolves.not.toThrow();
  });

  test("PATCH /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        password: await crypto.sign("password"),
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

    await expect(crypto.assert("new-password", found.password!)).resolves.not.toThrow();
  });
});
