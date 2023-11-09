import { Scope } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationSession, Client } from "../../entity";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { assertAuthorizeScope } from "./assert-authorize-scope";

describe("assertAuthorizeScope", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: [],
        scopes: [Scope.EMAIL, Scope.PHONE],
      },
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      scopes: [Scope.EMAIL, Scope.PHONE, Scope.ADDRESS],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeScope(authorizationSession, client)).not.toThrow();
  });

  test("should throw", () => {
    client.allowed = {
      ...client.allowed,
      scopes: [Scope.OFFLINE_ACCESS],
    };

    expect(() => assertAuthorizeScope(authorizationSession, client)).toThrow(ClientError);
  });
});
