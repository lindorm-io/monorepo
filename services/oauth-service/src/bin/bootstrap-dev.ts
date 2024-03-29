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
import { Client, Tenant } from "../entity";
import { ClientRepository, TenantRepository } from "../infrastructure";
import { argon, mongoConnection, redisConnection } from "../instance";
import { logger } from "./util/logger";

const ids = {
  authenticationService: "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
  communicationService: "aec0a293-4371-450a-bcfa-0f60f1f51a65",
  deviceService: "8da48653-ba29-416e-b882-393b60dce178",
  identityService: "9993fa84-bedf-4a93-a421-1f63719cd9d3",
  federationService: "3e0ab7aa-f445-4031-ad27-d87ff23d2ce2",
  vaultService: "c233687a-c610-412c-985b-5f6e95fbf47d",
  authApplication: "1061f927-d799-487d-bc30-0061dff84447",
};

const secrets = {
  authenticationService: "m4Qq7lqmydszhLq4-dR6tzI11CWlfKnckPwUBm_qrlEgWV4ouOgqNVZBsF7xGGQ3",
  communicationService: "2pBUdV9qyAEh1efe_8sMZUFXw2HPDkct9209UWVLSloY-Rt9fzn_N2wjKbAy-MOX",
  deviceService: "v5ifdZHwIXV12AlZ7FC8vc1AwgeEqgxNXf5EjmhPyycgKq6U0iIqtZRxIhC2wE1W",
  identityService: "NnvjOhoTd7SQtuSzKgPU6LoB7mRUjR3i4I5vJVGxJXwuxE6RxP3X2Md5Yv9w6RSF",
  federationService: "rjasuBK8yLFR68_n6J_ySa0WA3gwAQN-NHEvVxAMzQDeuqP_lxHY4LN-JTmeXp7R",
  vaultService: "oRGyqy9VzNFrZKLXs5VV5Gl8gLLXYI4QcLUfO6oEDz7VUMaCwY6srKnqUHha7jha",
  authApplication: "t3WZCoXASEkk5PTh8hQ_ThOySjbYz7hhHauyz0ZtMelW5TDGt2UhbDctFoD-KAU8",
};

const repositories = {
  client: new ClientRepository(mongoConnection, logger),
  tenant: new TenantRepository(mongoConnection, logger),
};

const main = async (): Promise<void> => {
  await mongoConnection.connect();
  await redisConnection.connect();

  const tenant = await repositories.tenant.create(
    new Tenant({
      id: "12507e8d-aa23-4132-8fd4-5aca0ae792cc",
      active: true,
      name: "lindorm.io/tenant",
      owner: "acbfce9e-072b-450f-b451-5915cdd17a33",
      subdomain: "root",
      trusted: true,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.authenticationService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/authentication-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.authenticationService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.communicationService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/communication-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.communicationService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.deviceService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/device-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.deviceService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.identityService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/identity-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.identityService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.federationService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/federation-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.federationService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.vaultService,
      allowed: {
        codeChallengeMethods: [],
        grantTypes: [OpenIdGrantType.CLIENT_CREDENTIALS],
        methods: [],
        responseTypes: [],
        scopes: [],
        strategies: [],
      },
      audiences: {
        credentials: Object.values(ids),
        identity: [],
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost",
      name: "lindorm.io/vault-service",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      secret: await argon.sign(secrets.vaultService),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.authApplication,
      allowed: {
        codeChallengeMethods: [PKCEMethod.SHA256],
        grantTypes: [OpenIdGrantType.AUTHORIZATION_CODE, OpenIdGrantType.REFRESH_TOKEN],
        methods: Object.values(AuthenticationMethod),
        responseTypes: Object.values(OpenIdResponseType),
        scopes: Object.values(Scope),
        strategies: Object.values(AuthenticationStrategy),
      },
      audiences: {
        credentials: [],
        identity: Object.values(ids),
      },
      authenticationAssertion: { algorithm: null, issuer: null, secret: null },
      authorizationAssertion: { algorithm: null, issuer: null, secret: null },
      backchannelAuth: {
        mode: OpenIdBackchannelAuthMode.POLL,
        uri: null,
        username: null,
        password: null,
      },
      customClaims: { uri: null, username: null, password: null },
      defaults: {
        displayMode: OpenIdDisplayMode.PAGE,
        levelOfAssurance: 1,
        responseMode: OpenIdResponseMode.QUERY,
      },
      expiry: {
        accessToken: "3 minutes",
        idToken: "24 hours",
        refreshToken: "30 days",
      },
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
      active: true,
      backchannelLogoutUri: "http://localhost/logout",
      domain: "http://localhost:4100",
      name: "lindorm.io/auth-application",
      profile: OpenIdClientProfile.USER_AGENT_BASED_APPLICATION,
      redirectUris: ["http://localhost:4100/api/callback"],
      secret: await argon.sign(secrets.authApplication),
      singleSignOn: true,
      tenantId: tenant.id,
      trusted: true,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  logger.info("Generated Entities", {
    applications: {
      auth: {
        id: ids.authApplication,
        secret: secrets.authApplication,
      },
    },
    services: {
      authentication: {
        id: ids.authenticationService,
        secret: secrets.authenticationService,
      },
      communication: {
        id: ids.communicationService,
        secret: secrets.communicationService,
      },
      device: {
        id: ids.deviceService,
        secret: secrets.deviceService,
      },
      identity: {
        id: ids.identityService,
        secret: secrets.identityService,
      },
      federation: {
        id: ids.federationService,
        secret: secrets.federationService,
      },
      vault: {
        id: ids.vaultService,
        secret: secrets.vaultService,
      },
    },
    tenant: {
      id: tenant.id,
      owner: tenant.owner,
    },
  });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
