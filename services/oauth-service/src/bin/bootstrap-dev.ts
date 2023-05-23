import {
  AuthenticationMethod,
  AuthenticationStrategy,
  LindormScope,
  OpenIdClientType,
  OpenIdDisplayMode,
  OpenIdGrantType,
  OpenIdResponseMode,
  OpenIdResponseType,
  OpenIdScope,
} from "@lindorm-io/common-types";
import { Client, Tenant } from "../entity";
import { ClientRepository, TenantRepository } from "../infrastructure";
import { argon, mongoConnection, redisConnection } from "../instance";
import { logger } from "./util/logger";

const ids = {
  authenticationService: "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
  communicationService: "aec0a293-4371-450a-bcfa-0f60f1f51a65",
  deviceService: "8da48653-ba29-416e-b882-393b60dce178",
  identityService: "9993fa84-bedf-4a93-a421-1f63719cd9d3",
  oidcService: "3e0ab7aa-f445-4031-ad27-d87ff23d2ce2",
  vaultService: "c233687a-c610-412c-985b-5f6e95fbf47d",
  authApplication: "1061f927-d799-487d-bc30-0061dff84447",
};

const secrets = {
  authenticationService: "m4Qq7lqmydszhLq4-dR6tzI11CWlfKnckPwUBm_qrlEgWV4ouOgqNVZBsF7xGGQ3",
  communicationService: "2pBUdV9qyAEh1efe_8sMZUFXw2HPDkct9209UWVLSloY-Rt9fzn_N2wjKbAy-MOX",
  deviceService: "v5ifdZHwIXV12AlZ7FC8vc1AwgeEqgxNXf5EjmhPyycgKq6U0iIqtZRxIhC2wE1W",
  identityService: "NnvjOhoTd7SQtuSzKgPU6LoB7mRUjR3i4I5vJVGxJXwuxE6RxP3X2Md5Yv9w6RSF",
  oidcService: "rjasuBK8yLFR68_n6J_ySa0WA3gwAQN-NHEvVxAMzQDeuqP_lxHY4LN-JTmeXp7R",
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
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.authenticationService,
      allowed: {
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
      active: true,
      host: "http://localhost",
      name: "lindorm.io/authentication-service",
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.authenticationService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.communicationService,
      allowed: {
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
      active: true,
      host: "http://localhost",
      name: "lindorm.io/communication-service",
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.communicationService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.deviceService,
      allowed: {
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
      active: true,
      host: "http://localhost",
      name: "lindorm.io/device-service",
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.deviceService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.identityService,
      allowed: {
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
      active: true,
      host: "http://localhost",
      name: "lindorm.io/identity-service",
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.identityService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.oidcService,
      allowed: {
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
      active: true,
      host: "http://localhost",
      name: "lindorm.io/oidc-service",
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.oidcService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.vaultService,
      allowed: {
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
      active: true,
      backChannelLogoutUri: "http://localhost/logout",
      host: "http://localhost",
      name: "lindorm.io/vault-service",
      secret: await argon.encrypt(secrets.vaultService),
      singleSignOn: true,
      tenantId: tenant.id,
      type: OpenIdClientType.CONFIDENTIAL,
    }),
  );

  await repositories.client.create(
    new Client({
      id: ids.authApplication,
      allowed: {
        grantTypes: [OpenIdGrantType.AUTHORIZATION_CODE, OpenIdGrantType.REFRESH_TOKEN],
        methods: Object.values(AuthenticationMethod),
        responseTypes: Object.values(OpenIdResponseType),
        scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
        strategies: Object.values(AuthenticationStrategy),
      },
      audiences: {
        credentials: [],
        identity: Object.values(ids),
      },
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
      active: true,
      host: "http://localhost:4100",
      name: "lindorm.io/auth-application",
      redirectUris: ["http://localhost:4100/api/callback"],
      backChannelLogoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.authApplication),
      singleSignOn: true,
      tenantId: tenant.id,
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
      oidc: {
        id: ids.oidcService,
        secret: secrets.oidcService,
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
