import { OpenIdResponseType, PKCEMethod } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { AuthorizationSession, Client } from "../../entity";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { assertAuthorizeResponseType } from "./assert-authorize-response-type";

describe("assertAuthorizeResponseType", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: [OpenIdResponseType.CODE],
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      responseTypes: [OpenIdResponseType.CODE, OpenIdResponseType.ID_TOKEN],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeResponseType(authorizationSession, client)).not.toThrow();
  });

  test("should throw on invalid response type", () => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: [OpenIdResponseType.TOKEN],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallenge)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: null,
        codeChallengeMethod: PKCEMethod.SHA256,
      },
      responseTypes: [OpenIdResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallengeMethod)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: "codeChallenge",
        codeChallengeMethod: null,
      },
      responseTypes: [OpenIdResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });
});
