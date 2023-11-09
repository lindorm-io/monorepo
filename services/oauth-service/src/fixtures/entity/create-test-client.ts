import {
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdClientProfile,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
  Scope,
} from "@lindorm-io/common-enums";
import { Algorithm } from "@lindorm-io/key-pair";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { SCOPE_OPENID, SCOPE_PROFILE } from "../../constant";
import { Client, ClientAttributes } from "../../entity";

export const createTestClient = (options: Partial<ClientAttributes> = {}): Client =>
  new Client({
    allowed: {
      codeChallengeMethods: Object.values(PKCEMethod),
      grantTypes: Object.values(OpenIdGrantType),
      methods: Object.values(AuthenticationMethod),
      responseTypes: Object.values(OpenIdResponseType),
      scopes: Object.values(Scope),
      strategies: Object.values(AuthenticationStrategy),
      ...(options.allowed || {}),
    },
    audiences: {
      credentials: [randomUUID()],
      identity: [randomUUID()],
    },
    authenticationAssertion: {
      algorithm: Algorithm.HS256,
      issuer: "https://test.client.authentication.issuer",
      secret: randomString(32),
    },
    authorizationAssertion: {
      algorithm: Algorithm.HS256,
      issuer: "https://test.client.authorization.issuer",
      secret: randomString(32),
    },
    customClaims: {
      uri: "https://test.client.lindorm.io/claims",
      username: null,
      password: null,
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
    description: "Client description",
    domain: "https://test.client.lindorm.io",
    logoUri: "https://logo.uri/logo",
    name: "ClientName",
    opaqueAccessToken: true,
    postLogoutUris: ["https://test.client.lindorm.io/logout"],
    profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
    redirectUris: ["https://test.client.lindorm.io/redirect"],
    requiredScopes: [Scope.OFFLINE_ACCESS, Scope.OPENID],
    rtbfUri: "https://test.client.lindorm.io/rtbf",
    scopeDescriptions: [SCOPE_OPENID, SCOPE_PROFILE],
    secret:
      "$argon2id$v=19$m=2048,t=32,p=2$gMJgh4L58ROHKxfiK12KRWTqX0Nz4xNrNJOZBHOvVYfvlDnnidbIq0iROKGR9Ugkhd0fqXntHZ0",
    singleSignOn: true,
    tenantId: randomUUID(),
    trusted: true,
    type: OpenIdClientType.CONFIDENTIAL,
    ...options,
  });
