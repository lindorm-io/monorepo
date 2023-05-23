import { OpenIdScope } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationRequest, Client } from "../../entity";
import { createTestAuthorizationRequest, createTestClient } from "../../fixtures/entity";
import { assertAuthorizeScope } from "./assert-authorize-scope";

describe("assertAuthorizeScope", () => {
  let authorizationRequest: AuthorizationRequest;
  let client: Client;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest({
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
    expect(() => assertAuthorizeScope(authorizationRequest, client)).not.toThrow();
  });

  test("should throw", () => {
    client.allowed = {
      ...client.allowed,
      scopes: [OpenIdScope.OFFLINE_ACCESS],
    };

    expect(() => assertAuthorizeScope(authorizationRequest, client)).toThrow(ClientError);
  });
});
