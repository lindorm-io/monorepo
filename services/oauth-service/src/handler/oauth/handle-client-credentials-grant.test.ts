import { ClientError } from "@lindorm-io/errors";
import { getTestClient } from "../../test/entity";
import { handleClientCredentialsGrant } from "./handle-client-credentials-grant";
import { createClientCredentialsToken as _createClientCredentialsToken } from "../token";
import { ClientScope, Scope } from "../../common";

jest.mock("../token");

const createClientCredentialsToken = _createClientCredentialsToken as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        scope: "address email offline_access openid phone profile",
      },
      entity: {
        client: getTestClient({
          id: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
        }),
      },
    };

    createClientCredentialsToken.mockImplementation(() => ({
      token: "jwt.jwt.jwt",
      expiresIn: 999,
    }));
  });

  test("should resolve", async () => {
    await expect(handleClientCredentialsGrant(ctx)).resolves.toStrictEqual({
      accessToken: "jwt.jwt.jwt",
      expiresIn: 999,
      scope: [
        Scope.ADDRESS,
        Scope.EMAIL,
        Scope.OFFLINE_ACCESS,
        Scope.OPENID,
        Scope.PHONE,
        Scope.PROFILE,
        ClientScope.OAUTH_AUTHENTICATION_READ,
        ClientScope.OAUTH_AUTHENTICATION_WRITE,
        ClientScope.OAUTH_CLIENT_DELETE,
        ClientScope.OAUTH_CLIENT_READ,
        ClientScope.OAUTH_CLIENT_WRITE,
        ClientScope.COMMUNICATION_MESSAGE_SEND,
        ClientScope.IDENTITY_IDENTIFIER_READ,
        ClientScope.IDENTITY_IDENTIFIER_WRITE,
        ClientScope.IDENTITY_IDENTITY_READ,
        ClientScope.IDENTITY_IDENTITY_WRITE,
        ClientScope.OAUTH_LOGOUT_READ,
        ClientScope.OAUTH_LOGOUT_WRITE,
      ],
      tokenType: "Bearer",
    });
  });

  test("should throw on invalid client", async () => {
    ctx.entity.client.active = false;

    await expect(handleClientCredentialsGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid scope", async () => {
    ctx.data.scope = "wrong";

    await expect(handleClientCredentialsGrant(ctx)).rejects.toThrow(ClientError);
  });
});
