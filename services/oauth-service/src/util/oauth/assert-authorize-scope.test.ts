import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertAuthorizeScope } from "./assert-authorize-scope";
import { getTestAuthorizationSession, getTestClient } from "../../test/entity";

describe("assertAuthorizeScope", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = getTestAuthorizationSession({
      scopes: ["scope1", "scope2"],
    });

    client = getTestClient();

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
