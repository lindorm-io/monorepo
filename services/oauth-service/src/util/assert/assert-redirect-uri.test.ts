import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertRedirectUri } from "./assert-redirect-uri";
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
    expect(() => assertRedirectUri(authorizationSession.redirectUri, client)).not.toThrow();
  });

  test("should throw", () => {
    client.redirectUris = ["REDIRECT2"];

    expect(() => assertRedirectUri(authorizationSession.redirectUri, client)).toThrow(ClientError);
  });
});
