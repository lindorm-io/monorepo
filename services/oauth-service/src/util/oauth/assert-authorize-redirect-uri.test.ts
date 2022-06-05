import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizeRedirectUri } from "./assert-authorize-redirect-uri";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";

describe("assertAuthorizeRedirectUri", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      redirectUri: "REDIRECT1",
    });

    client = createTestClient();

    client.redirectUris = ["REDIRECT1"];
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeRedirectUri(authorizationSession, client)).not.toThrow();
  });

  test("should throw", () => {
    client.redirectUris = ["REDIRECT2"];

    expect(() => assertAuthorizeRedirectUri(authorizationSession, client)).toThrow(ClientError);
  });
});
