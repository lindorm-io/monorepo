import { Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertRedirectUri } from "./assert-redirect-uri";
import { createTestClient } from "../../fixtures/entity";

describe("assertRedirectUri", () => {
  let client: Client;

  beforeEach(() => {
    client = createTestClient();
  });

  test("should succeed", () => {
    expect(() =>
      assertRedirectUri(client, "https://test.client.lindorm.io/redirect"),
    ).not.toThrow();
  });

  test("should throw", () => {
    expect(() => assertRedirectUri(client, "https://test.client.lindorm.io/wrong")).toThrow(
      ClientError,
    );
  });
});
