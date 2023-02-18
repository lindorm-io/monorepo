import { Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertPostLogoutRedirectUri } from "./assert-post-logout-redirect-uri";
import { createTestClient } from "../../fixtures/entity";

describe("assertAuthorizePostLogoutRedirectUri", () => {
  let client: Client;

  beforeEach(() => {
    client = createTestClient();
  });

  test("should succeed", () => {
    expect(() =>
      assertPostLogoutRedirectUri(client, "https://test.client.lindorm.io/logout"),
    ).not.toThrow();
  });

  test("should throw", () => {
    expect(() =>
      assertPostLogoutRedirectUri(client, "https://test.client.lindorm.io/wrong"),
    ).toThrow(ClientError);
  });
});
