import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizeRedirectUri } from "./assert-authorize-redirect-uri";
import { getTestAuthorizationSession, getTestClient } from "../../test/entity";

describe("assertAuthorizeRedirectUri", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = getTestAuthorizationSession({
      redirectUri: "REDIRECT1",
    });

    client = getTestClient();

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
