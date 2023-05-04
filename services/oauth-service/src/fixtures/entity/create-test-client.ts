import {
  LindormScope,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { randomUUID } from "crypto";
import { SCOPE_OPENID, SCOPE_PROFILE } from "../../constant";
import { Client, ClientAttributes } from "../../entity";

export const createTestClient = (options: Partial<ClientAttributes> = {}): Client =>
  new Client({
    allowed: {
      grantTypes: Object.values(OpenIdGrantType),
      responseTypes: Object.values(OpenIdResponseType),
      scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
      ...(options.allowed || {}),
    },
    audiences: {
      credentials: [randomUUID()],
      identity: [randomUUID()],
    },
    defaults: {
      displayMode: OpenIdDisplayMode.POPUP,
      levelOfAssurance: 3,
      responseMode: OpenIdResponseMode.QUERY,
      ...(options.defaults || {}),
    },
    expiry: {
      accessToken: "99 seconds",
      idToken: "99 seconds",
      refreshToken: "99 seconds",
      ...(options.expiry || {}),
    },

    active: true,
    backChannelLogoutUri: "https://test.client.lindorm.io/back-channel-logout",
    claimsUri: "https://test.client.lindorm.io/claims",
    description: "Client description",
    host: "https://test.client.lindorm.io",
    logoUri: "https://logo.uri/logo",
    name: "ClientName",
    opaqueAccessToken: false,
    opaqueRefreshToken: false,
    postLogoutUris: ["https://test.client.lindorm.io/logout"],
    redirectUris: ["https://test.client.lindorm.io/redirect"],
    requiredScopes: [OpenIdScope.OFFLINE_ACCESS, OpenIdScope.OPENID],
    rtbfUri: "https://test.client.lindorm.io/rtbf",
    scopeDescriptions: [SCOPE_OPENID, SCOPE_PROFILE],
    secret:
      "$argon2id$v=19$m=2048,t=32,p=2$gMJgh4L58ROHKxfiK12KRWTqX0Nz4xNrNJOZBHOvVYfvlDnnidbIq0iROKGR9Ugkhd0fqXntHZ0",
    singleSignOn: true,
    tenantId: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
    type: OpenIdClientType.CONFIDENTIAL,
    ...options,
  });
