import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { CryptoAES } from "@lindorm-io/crypto";
import { TOTPHandler } from "../../class";
import { authenticator } from "otplib";
import { baseParse } from "@lindorm-io/core";
import { configuration } from "../../server/configuration";
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

  const aes = new CryptoAES({ secret: salt });

  const totpHandler = new TOTPHandler({
    aes: { secret: salt },
    issuer: configuration.server.issuer,
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

  test("GET /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        totp: null,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account/totp")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    expect(response.body).toStrictEqual({ uri: expect.any(String) });

    const code = authenticator.generate(aes.decrypt(baseParse(found.totp!)));

    expect(() => totpHandler.assert(code, found.totp!)).not.toThrow();
  });

  test("DELETE /", async () => {
    const data = totpHandler.generate();

    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        totp: data.signature,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const code = authenticator.generate(aes.decrypt(baseParse(data.signature)));

    await request(server.callback())
      .delete("/account/totp")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        totp: code,
      })
      .expect(204);

    await expect(TEST_ACCOUNT_REPOSITORY.find({ id: account.id })).resolves.toStrictEqual(
      expect.objectContaining({
        totp: null,
      }),
    );
  });
});
