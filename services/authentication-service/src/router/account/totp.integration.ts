import { CryptoAes } from "@lindorm-io/crypto";
import { randomBytes } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import { authenticator } from "otplib";
import request from "supertest";
import { TotpHandler } from "../../class";
import { createTestAccount } from "../../fixtures/entity";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_ACCOUNT_REPOSITORY,
} from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/account/password", () => {
  const secret = randomBytes(16).toString("hex");
  const aes = new CryptoAes({ secret });

  const totpHandler = new TotpHandler({
    aes: { secret },
    issuer: configuration.server.issuer,
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

    const code = authenticator.generate(aes.decrypt(found.totp!));

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

    const code = authenticator.generate(aes.decrypt(data.signature));

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
