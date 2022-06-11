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

describe("/account", () => {
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
      accessToken: "accessToken",
      expiresIn: 100,
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

  test("GET /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount());

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account")
      .set("Authorization", accessToken)
      .expect(200);

    expect(response.body).toStrictEqual({
      browser_link_code: true,
      password: true,
      recovery_code: true,
      totp: true,
    });
  });

  test("GET /browser-link", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        browserLinkCode: null,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account/browser-link-code")
      .set("Authorization", accessToken)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
    });

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert(response.body.code, found.browserLinkCode)).resolves.not.toThrow();
  });

  test("GET /recovery-code", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount({ recoveryCode: null }));

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account/recovery-code")
      .set("Authorization", accessToken)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
    });

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert(response.body.code, found.recoveryCode)).resolves.not.toThrow();
  });
});
