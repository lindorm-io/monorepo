import { Client, Tenant } from "../entity";
import { ClientCache, ClientRepository, TenantRepository } from "../infrastructure";
import { ClientPermission, ClientScope, ClientType, GrantType } from "../common";
import { argon, mongoConnection, redisConnection } from "../instance";
import { logger } from "./util/logger";

const ids = {
  authentication: "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
  communication: "aec0a293-4371-450a-bcfa-0f60f1f51a65",
  device: "8da48653-ba29-416e-b882-393b60dce178",
  identity: "9993fa84-bedf-4a93-a421-1f63719cd9d3",
  oidc: "3e0ab7aa-f445-4031-ad27-d87ff23d2ce2",
  vault: "c233687a-c610-412c-985b-5f6e95fbf47d",
};

const secrets = {
  authentication: "kHuCFwhRR3joU3sjMPiKC0P5XwB62AAoYHJ6H9T6jJcYcpm3Vnj9AyYDIJGttD1E",
  communication: "8uXj4edcXTOvT7BbB9ecspvfXrujPmIViFr7jw2k5sZVlleDI58WUg6V6HbjG2Md",
  device: "siKP6qVeEoBxTOPV4Q4Ijiy6laUhgKXaZfrSYWJKBm3IfiO04fie7KIeFJdIbFUJ",
  identity: "SXYF5eM47qn2fpqLkaeoy6c1R0AHKPssz0TfCpM3evxJzNasfrgaeFeMByJLmhpq",
  oidc: "5NTac6bAnSNAWnMh0pCjABmlv1ca6LUml88gaQrQrBU3aNS6W6LpJp9r3ViclTe8",
  vault: "aOpwpLy8XQhxExub2h68K0Puddy5CM9FO1v1XSZVIhvoSRvGlv0Fih6ofUCrwNmx",
};

const repositories = {
  client: new ClientRepository({ connection: mongoConnection, logger }),
  tenant: new TenantRepository({ connection: mongoConnection, logger }),
};

const caches = {
  client: new ClientCache({ connection: redisConnection, logger }),
};

const main = async (): Promise<void> => {
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
      id: ids.authentication,
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
      secret: await argon.encrypt(secrets.authentication),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(authentication);

  const communication = await repositories.client.create(
    new Client({
      id: ids.communication,
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
      secret: await argon.encrypt(secrets.communication),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(communication);

  const device = await repositories.client.create(
    new Client({
      id: ids.device,
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
      secret: await argon.encrypt(secrets.device),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(device);

  const identity = await repositories.client.create(
    new Client({
      id: ids.identity,
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
      secret: await argon.encrypt(secrets.identity),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(identity);

  const oidc = await repositories.client.create(
    new Client({
      id: ids.oidc,
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
      secret: await argon.encrypt(secrets.oidc),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(oidc);

  const vault = await repositories.client.create(
    new Client({
      id: ids.vault,
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
      secret: await argon.encrypt(secrets.vault),
      tenant: tenant.id,
      type: ClientType.CONFIDENTIAL,
    }),
  );
  await caches.client.create(vault);

  logger.info("Generated Entities", {
    authentication: { id: ids.authentication, secret: secrets.authentication },
    communication: { id: ids.communication, secret: secrets.communication },
    device: { id: ids.device, secret: secrets.device },
    identity: { id: ids.identity, secret: secrets.identity },
    oidc: { id: ids.oidc, secret: secrets.oidc },
    vault: { id: ids.vault, secret: secrets.vault },
    tenant: { id: tenant.id, owner: tenant.owner },
  });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
