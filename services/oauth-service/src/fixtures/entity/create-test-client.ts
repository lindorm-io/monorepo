import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "@lindorm-io/aes";
import {
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdBackchannelAuthMode,
  OpenIdClientProfile,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  PKCEMethod,
  Scope,
} from "@lindorm-io/common-enums";
import { KeyPairAlgorithm } from "@lindorm-io/key-pair";
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
      algorithm: KeyPairAlgorithm.HS256,
      issuer: "https://test.client.authentication.issuer",
      secret: randomString(32),
    },
    authorizationAssertion: {
      algorithm: KeyPairAlgorithm.HS256,
      issuer: "https://test.client.authorization.issuer",
      secret: randomString(32),
    },
    backchannelAuth: {
      mode: OpenIdBackchannelAuthMode.POLL,
      uri: "https://test.client.lindorm.io/backchannel-auth-callback",
      password: null,
      username: null,
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
    idTokenEncryption: {
      algorithm: AesAlgorithm.AES_256_GCM,
      encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm.RSA_OAEP_256,
    },

    active: true,
    backchannelLogoutUri: "https://test.client.lindorm.io/backchannel-logout",
    description: "Client description",
    domain: "https://test.client.lindorm.io",
    jwks: [],
    jwksUri: "https://test.client.lindorm.io/.well-known/jwks.json",
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
