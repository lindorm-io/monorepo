import { OpenIdResponseType, PKCEMethod } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationRequest, Client } from "../../entity";
import { createTestAuthorizationRequest, createTestClient } from "../../fixtures/entity";
import { assertAuthorizeResponseType } from "./assert-authorize-response-type";

describe("assertAuthorizeResponseType", () => {
  let authorizationRequest: AuthorizationRequest;
  let client: Client;

  beforeEach(() => {
    authorizationRequest = createTestAuthorizationRequest({
      responseTypes: [OpenIdResponseType.CODE],
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      responseTypes: [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeResponseType(authorizationRequest, client)).not.toThrow();
  });

  test("should throw on invalid response type", () => {
    authorizationRequest = createTestAuthorizationRequest({
      responseTypes: [OpenIdResponseType.TOKEN],
    });

    expect(() => assertAuthorizeResponseType(authorizationRequest, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallenge)", () => {
    authorizationRequest = createTestAuthorizationRequest({
      code: {
        codeChallenge: null,
        codeChallengeMethod: PKCEMethod.SHA256,
      },
      responseTypes: [OpenIdResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationRequest, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallengeMethod)", () => {
    authorizationRequest = createTestAuthorizationRequest({
      code: {
        codeChallenge: "codeChallenge",
        codeChallengeMethod: null,
      },
      responseTypes: [OpenIdResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationRequest, client)).toThrow(ClientError);
  });
});
