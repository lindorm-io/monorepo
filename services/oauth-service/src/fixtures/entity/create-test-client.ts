import { Client, ClientAttributes } from "../../entity";
import { SCOPE_OPENID, SCOPE_PROFILE } from "../../constant";
import { ClientScopes } from "../../common";
import {
  LindormScopes,
  OauthClientTypes,
  OauthDisplayModes,
  OauthGrantTypes,
  OauthResponseModes,
  OauthResponseTypes,
} from "@lindorm-io/common-types";

export const createTestClient = (options: Partial<ClientAttributes> = {}): Client =>
  new Client({
    active: true,
    allowed: {
      grantTypes: Object.values(OauthGrantTypes),
      responseTypes: Object.values(OauthResponseTypes),
      scopes: [...Object.values(LindormScopes), ...Object.values(ClientScopes)],
      ...(options.allowed || {}),
    },
    defaults: {
      audiences: [],
      displayMode: OauthDisplayModes.POPUP,
      levelOfAssurance: 3,
      responseMode: OauthResponseModes.QUERY,
      ...(options.defaults || {}),
    },
    description: "Client description",
    expiry: {
      accessToken: "99 seconds",
      idToken: "99 seconds",
      refreshToken: "99 seconds",
      ...(options.expiry || {}),
    },
    host: "https://test.client.lindorm.io",
    logoUri: "https://logo.uri/logo",
    logoutUri: "https://test.client.lindorm.io/logout/back-channel",
    name: "ClientName",
    redirectUris: ["https://test.client.lindorm.io/redirect"],
    requiredScopes: [LindormScopes.OFFLINE_ACCESS, LindormScopes.OPENID],
    rtbfUri: "https://test.client.lindorm.io/rtbf",
    scopeDescriptions: [SCOPE_OPENID, SCOPE_PROFILE],
    secret:
      "$argon2id$v=19$m=2048,t=32,p=2$gMJgh4L58ROHKxfiK12KRWTqX0Nz4xNrNJOZBHOvVYfvlDnnidbIq0iROKGR9Ugkhd0fqXntHZ0",
    tenant: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
    type: OauthClientTypes.CONFIDENTIAL,
    ...options,
  });
