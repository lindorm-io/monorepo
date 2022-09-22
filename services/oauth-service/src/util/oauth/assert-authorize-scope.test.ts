import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizeScope } from "./assert-authorize-scope";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";

describe("assertAuthorizeScope", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      requestedConsent: {
        audiences: [],
        scopes: ["scope1", "scope2"],
      },
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      scopes: ["scope1", "scope2", "scope3"],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeScope(authorizationSession, client)).not.toThrow();
  });

  test("should throw", () => {
    client.allowed = {
      ...client.allowed,
      scopes: ["scope4"],
    };

    expect(() => assertAuthorizeScope(authorizationSession, client)).toThrow(ClientError);
  });
});
