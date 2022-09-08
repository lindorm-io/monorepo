import { Client, Tenant } from "../entity";
import { ClientCache, ClientRepository, TenantRepository } from "../infrastructure";
import { ClientPermission, ClientScope, ClientType, GrantType } from "../common";
import { argon, mongoConnection, redisConnection } from "../instance";
import { logger } from "./util/logger";

const ids = {
  authenticationService: "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
  communicationService: "aec0a293-4371-450a-bcfa-0f60f1f51a65",
  deviceService: "8da48653-ba29-416e-b882-393b60dce178",
  identityService: "9993fa84-bedf-4a93-a421-1f63719cd9d3",
  oidcService: "3e0ab7aa-f445-4031-ad27-d87ff23d2ce2",
  vaultService: "c233687a-c610-412c-985b-5f6e95fbf47d",
};

const secrets = {
  authenticationService: "kHuCFwhRR3joU3sjMPiKC0P5XwB62AAoYHJ6H9T6jJcYcpm3Vnj9AyYDIJGttD1E",
  communicationService: "8uXj4edcXTOvT7BbB9ecspvfXrujPmIViFr7jw2k5sZVlleDI58WUg6V6HbjG2Md",
  deviceService: "siKP6qVeEoBxTOPV4Q4Ijiy6laUhgKXaZfrSYWJKBm3IfiO04fie7KIeFJdIbFUJ",
  identityService: "SXYF5eM47qn2fpqLkaeoy6c1R0AHKPssz0TfCpM3evxJzNasfrgaeFeMByJLmhpq",
  oidcService: "5NTac6bAnSNAWnMh0pCjABmlv1ca6LUml88gaQrQrBU3aNS6W6LpJp9r3ViclTe8",
  vaultService: "aOpwpLy8XQhxExub2h68K0Puddy5CM9FO1v1XSZVIhvoSRvGlv0Fih6ofUCrwNmx",
};

const repositories = {
  client: new ClientRepository({ connection: mongoConnection, logger }),
  tenant: new TenantRepository({ connection: mongoConnection, logger }),
};

const caches = {
  client: new ClientCache({ connection: redisConnection, logger }),
};

const main = async (): Promise<void> => {
  await mongoConnection.connect();
  await redisConnection.connect();

  const tenant = await repositories.tenant.create(
    new Tenant({
      id: "12507e8d-aa23-4132-8fd4-5aca0ae792cc",
      active: true,
      administrators: ["acbfce9e-072b-450f-b451-5915cdd17a33"],
      name: "lindorm.io/tenant",
      owner: "acbfce9e-072b-450f-b451-5915cdd17a33",
      subdomain: "root",
    }),
  );

  const authentication = await repositories.client.create(
    new Client({
      id: ids.authenticationService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/authentication-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.authenticationService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(authentication);

  const communication = await repositories.client.create(
    new Client({
      id: ids.communicationService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/communication-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.communicationService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(communication);

  const device = await repositories.client.create(
    new Client({
      id: ids.deviceService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/device-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.deviceService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(device);

  const identity = await repositories.client.create(
    new Client({
      id: ids.identityService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/identity-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.identityService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(identity);

  const oidc = await repositories.client.create(
    new Client({
      id: ids.oidcService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/oidc-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.oidcService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(oidc);

  const vault = await repositories.client.create(
    new Client({
      id: ids.vaultService,
      active: true,
      allowed: {
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
        responseTypes: [],
        scopes: Object.values(ClientScope),
      },
      host: "http://localhost",
      name: "lindorm.io/vault-service",
      permissions: Object.values(ClientPermission),
      redirectUris: [],
      logoutUri: "http://localhost/logout",
      secret: await argon.encrypt(secrets.vaultService),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(vault);

  logger.info("Generated Entities", {
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
