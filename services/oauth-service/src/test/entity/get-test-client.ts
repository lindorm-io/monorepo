import { Client, ClientOptions } from "../../entity";
import { SCOPE_OPENID, SCOPE_PROFILE } from "../../constant";
import {
  ClientPermission,
  ClientScope,
  ClientType,
  DisplayMode,
  GrantType,
  ResponseMode,
  ResponseType,
  Scope,
} from "../../common";

export const getTestClient = (options: Partial<ClientOptions> = {}): Client =>
  new Client({
    active: true,
    allowed: {
      grantTypes: [
        GrantType.AUTHORIZATION_CODE,
        GrantType.CLIENT_CREDENTIALS,
        GrantType.REFRESH_TOKEN,
      ],
      responseTypes: [ResponseType.CODE, ResponseType.ID_TOKEN, ResponseType.TOKEN],
      scopes: [
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
    },
    defaults: {
      displayMode: DisplayMode.POPUP,
      levelOfAssurance: 3,
      responseMode: ResponseMode.QUERY,
    },
    description: "Client description",
    expiry: {
      accessToken: "99 seconds",
      idToken: "99 seconds",
      refreshToken: "99 seconds",
    },
    host: "https://test.client.lindorm.io",
    logoUri: "https://logo.uri/logo",
    logoutUri: "https://test.client.lindorm.io/logout/back-channel",
    name: "ClientName",
    owners: ["d1b90ac7-69a6-4187-92f2-46e9dceccde9"],
    permissions: [
      ClientPermission.AUTHENTICATION_CONFIDENTIAL,
      ClientPermission.COMMUNICATION_CONFIDENTIAL,
      ClientPermission.DEVICE_CONFIDENTIAL,
      ClientPermission.IDENTITY_CONFIDENTIAL,
      ClientPermission.OAUTH_CONFIDENTIAL,
    ],
    redirectUri: "https://test.client.lindorm.io/redirect",
    requiredScopes: [Scope.OFFLINE_ACCESS, Scope.OPENID],
    scopeDescriptions: [SCOPE_OPENID, SCOPE_PROFILE],
    secret:
      "$argon2id$v=19$m=2048,t=32,p=2$gMJgh4L58ROHKxfiK12KRWTqX0Nz4xNrNJOZBHOvVYfvlDnnidbIq0iROKGR9Ugkhd0fqXntHZ0",
    type: ClientType.CONFIDENTIAL,
    ...options,
  });
