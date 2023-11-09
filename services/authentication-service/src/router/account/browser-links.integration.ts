import { Environment } from "@lindorm-io/common-enums";
import { CryptoLayered } from "@lindorm-io/crypto";
import { EntityNotFoundError } from "@lindorm-io/entity";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestAccount, createTestBrowserLink } from "../../fixtures/entity";
import {
  TEST_ACCOUNT_REPOSITORY,
  TEST_BROWSER_LINK_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/account/browser-link", () => {
  const salt =
    "84s8VNdOtIvwL6KvNd28YktehfPhwGy0xObf7c7yr6Vz3XwH3CA9aOi7rSYKhPICaTukA0qqSzVhm1WW1L48YvpYD9OLAaNFqSAy6VIdA3NF096aBoawvt2boQkHF5tC";

  const crypto = new CryptoLayered({
    aes: { secret: salt },
    sha: { secret: salt },
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
        aes: salt,
        sha: salt,
      },
    });

  test("POST /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        browserLinkCode: await crypto.encrypt("browser-link-code"),
        password: await crypto.encrypt("password"),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .post("/account/browser-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .set(
        "User-Agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0",
      )
      .set("x-client-environment", Environment.TEST)
      .send({
        code: "browser-link-code",
        password: "password",
      })
      .expect(204);

    const browserLink = await TEST_BROWSER_LINK_REPOSITORY.find({ accountId: account.id });

    expect(response.headers["set-cookie"]).toEqual([
      `lindorm_io_authentication_browser_link=${browserLink.id}; path=/; expires=Mon, 01 Jan 2120 08:00:00 GMT; httponly`,
    ]);
  });

  test("GET /", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        browserLinkCode: await crypto.encrypt("browser-link-code"),
        password: await crypto.encrypt("password"),
      }),
    );

    const browserLink = await TEST_BROWSER_LINK_REPOSITORY.create(
      createTestBrowserLink({
        accountId: account.id,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    const response = await request(server.callback())
      .get("/account/browser-links")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      browser_links: [
        {
          id: browserLink.id,
          browser: "browser",
          created: "2021-01-01T08:00:00.000Z",
          environment: "test",
          os: "os",
          platform: "platform",
        },
      ],
    });
  });

  test("DELETE /:id", async () => {
    const account = await TEST_ACCOUNT_REPOSITORY.create(
      createTestAccount({
        browserLinkCode: await crypto.encrypt("browser-link-code"),
        password: await crypto.encrypt("password"),
      }),
    );

    const browserLink = await TEST_BROWSER_LINK_REPOSITORY.create(
      createTestBrowserLink({
        accountId: account.id,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: account.id,
    });

    await request(server.callback())
      .delete(`/account/browser-links/${browserLink.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await expect(TEST_BROWSER_LINK_REPOSITORY.find({ id: browserLink.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
