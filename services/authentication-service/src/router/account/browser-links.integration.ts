import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { CryptoLayered } from "@lindorm-io/crypto";
import { createTestAccount, createTestBrowserLink } from "../../fixtures/entity";
import { server } from "../../server/server";
import {
  TEST_ACCOUNT_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
  TEST_BROWSER_LINK_REPOSITORY,
} from "../../fixtures/integration";
import { Environment } from "@lindorm-io/koa";
import { EntityNotFoundError } from "@lindorm-io/entity";

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
      .set("Authorization", accessToken)
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
      `lindorm_io_authentication_browser_link=${browserLink.id}; path=/; expires=Mon, 01 Jan 2120 08:00:00 GMT; domain=https://test.lindorm.io; samesite=none`,
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
      .set("Authorization", accessToken)
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
      .set("Authorization", accessToken)
      .expect(204);

    await expect(TEST_BROWSER_LINK_REPOSITORY.find({ id: browserLink.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
