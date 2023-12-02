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

describe("/account", () => {
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

  test("GET /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount());

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      browser_link_code: true,
      password: true,
      recovery_code: true,
      require_mfa: true,
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
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
    });

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert(response.body.code, found.browserLinkCode!)).resolves.not.toThrow();
  });

  test("GET /recovery-code", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(createTestAccount({ recoveryCode: null }));

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account/recovery-code")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      code: expect.any(String),
    });

    const found = await TEST_ACCOUNT_REPOSITORY.find({ id: account.id });

    await expect(crypto.assert(response.body.code, found.recoveryCode!)).resolves.not.toThrow();
  });
});
