import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ResponseType } from "../../common";
import { assertAuthorizeResponseType } from "./assert-authorize-response-type";
import { getTestAuthorizationSession, getTestClient } from "../../test/entity";

describe("assertAuthorizeResponseType", () => {
  let authorizationSession: AuthorizationSession;
  let client: Client;

  beforeEach(() => {
    authorizationSession = getTestAuthorizationSession({
      responseTypes: [ResponseType.CODE],
    });

    client = getTestClient();

    client.allowed = {
      ...client.allowed,
      responseTypes: [ResponseType.CODE, ResponseType.ID_TOKEN],
    };
  });

  test("should succeed", () => {
    expect(() => assertAuthorizeResponseType(authorizationSession, client)).not.toThrow();
  });

  test("should throw on invalid response type", () => {
    authorizationSession = getTestAuthorizationSession({
      responseTypes: [ResponseType.TOKEN],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });

  test("should throw on invalid request data", () => {
    authorizationSession = getTestAuthorizationSession({
      codeChallenge: null,
      codeChallengeMethod: null,
      responseTypes: [ResponseType.CODE],
    });

    expect(() => assertAuthorizeResponseType(authorizationSession, client)).toThrow(ClientError);
  });
});
