import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizeScope } from "./assert-authorize-scope";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { OpenIdScope } from "@lindorm-io/common-types";

describe("assertAuthorizeScope", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: [],
        scopes: [OpenIdScope.EMAIL, OpenIdScope.PHONE],
      },
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      scopes: [OpenIdScope.EMAIL, OpenIdScope.PHONE, OpenIdScope.ADDRESS],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeScope(authorizationSession, client)).not.toThrow();
  });

  test("should throw", () => {
    client.allowed = {
      ...client.allowed,
      scopes: [OpenIdScope.OFFLINE_ACCESS],
    };

    expect(() => assertAuthorizeScope(authorizationSession, client)).toThrow(ClientError);
  });
});
