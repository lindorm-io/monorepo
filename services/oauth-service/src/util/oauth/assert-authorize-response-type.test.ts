import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ResponseType } from "../../common";
import { assertAuthorizeResponseType } from "./assert-authorize-response-type";
import { createTestAuthorizationSession, createTestClient } from "../../fixtures/entity";
import { PKCEMethod } from "@lindorm-io/core";

describe("assertAuthorizeResponseType", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: [ResponseType.CODE],
    });

    client = createTestClient();

    client.allowed = {
      ...client.allowed,
      responseTypes: [ResponseType.CODE, ResponseType.ID_TOKEN],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeResponseType(authorizationSession, client)).not.toThrow();
  });

  test("should throw on invalid response type", () => {
    authorizationSession = createTestAuthorizationSession({
      responseTypes: [ResponseType.TOKEN],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallenge)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: null,
        codeChallengeMethod: PKCEMethod.S256,
      },
      responseTypes: [ResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on missing data (codeChallengeMethod)", () => {
    authorizationSession = createTestAuthorizationSession({
      code: {
        codeChallenge: "codeChallenge",
        codeChallengeMethod: null,
      },
      responseTypes: [ResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });
});
