import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { PKCEMethod } from "@lindorm-io/node-pkce";
import { assertAuthorizeResponseType } from "./assert-authorize-response-type";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";

describe("assertAuthorizeResponseType", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: ["code"],
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      responseTypes: ["code", "id_token"],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeResponseType(authorizationSession, client)).not.toThrow();
  });

  test("should throw on invalid response type", () => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: ["token"],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallenge)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: null,
        codeChallengeMethod: PKCEMethod.S256,
      },
      responseTypes: ["code"],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallengeMethod)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: "codeChallenge",
        codeChallengeMethod: null,
      },
      responseTypes: ["code"],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });
});
