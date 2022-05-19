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
};

const secrets = {
  authentication:
    "JnywQD4xI1r0TtZNHSXpXFiZQbknHRGMpMGuPsILR3OYTtQDEUrb5KtQzu8BhbWhYYjtew49yN3VsFa38SkWDZ4CxgcOtfj6MNiCmFBRdzfAOkk4fJS1he11ViDEYTXp",
  communication:
    "23mxtxcwb5EcPcBCR43YN8bwnw1axbswKkZjam1qDrSO77NOR90s25pekjEbuzEIVuLzy8jeFm5781Xbt2U5btKnCLhOtddp4jI5JzfHghxqbkWDEU1aCKFzAQdC1OFT",
  device:
    "X4P2a8llWDVJbtzRAVnHObcLyOMAe2vYa2GAs2kSNXonlRcWblDYU07bJxC20B8Co2PJKpTITUBs2hEOV90Vr4o5zKhYme067RortdPmGoVpa6neHqNDZGIF1YXVcp36",
  identity:
    "bAJL5tCZr5lWBmJieQKqyFN9mBf8qN1G00YlIlTMtURg3gxJyFUSHvNvCTje3rdXNTifCX4xZHXeX8hvcWjgpmaZv9dS79OX2wK25XCl3NCI7DTwHIrBzL1zzh6A2uOb",
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

  logger.info("Generated Entities", {
    authentication: { id: ids.authentication, secret: secrets.authentication },
    communication: { id: ids.communication, secret: secrets.communication },
    device: { id: ids.device, secret: secrets.device },
    identity: { id: ids.identity, secret: secrets.identity },
    tenant: { id: tenant.id, owner: tenant.owner },
  });
};

main()
  .catch((err) => logger.error("Error", err))
  .finally(() => process.exit(0));
