import { createMockLogger } from "@lindorm-io/core-logger";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { MemoryDatabase } from "@lindorm-io/in-memory-cache";
import {
  createTestStoredKeySet,
  createTestStoredKeySetRsa,
  StoredKeySet,
} from "@lindorm-io/keystore";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { StoredKeySetMemoryCache } from "./StoredKeySetMemoryCache";

MockDate.set("2022-01-01T08:00:00.000Z");

describe("StoredKeySetMemory", () => {
  let database: MemoryDatabase;
  let cache: StoredKeySetMemoryCache;
  let entity: StoredKeySet;

  const logger = createMockLogger();

  beforeAll(async () => {
    database = new MemoryDatabase();
    cache = new StoredKeySetMemoryCache(database, logger);
  });

  beforeEach(async () => {
    entity = await cache.create(
      createTestStoredKeySet({ id: randomUUID(), expiresAt: new Date("2022-01-01T08:15:00.000Z") }),
    );
  });

  test("should create", async () => {
    await expect(
      cache.create(
        new StoredKeySet({
          algorithm: "RS256",
          privateKey: "create",
          publicKey: "create",
          type: "RSA",
          use: "sig",
        }),
      ),
    ).resolves.toStrictEqual(expect.any(StoredKeySet));
  });

  test("should update with expiry", async () => {
    entity.webKeySet.expiresAt = new Date("2022-01-01T08:30:00.000Z");

    await expect(cache.update(entity)).resolves.toStrictEqual(
      expect.objectContaining({
        id: entity.id,
        updated: new Date("2022-01-01T08:00:00.000Z"),
      }),
    );
    await expect(cache.ttl(entity)).resolves.toBe(1800);
  });

  test("should find", async () => {
    await expect(cache.find({ id: entity.id })).resolves.toStrictEqual(
      expect.objectContaining({ id: entity.id }),
    );
  });

  test("should find many", async () => {
    const keyRSA = await cache.create(createTestStoredKeySetRsa({ id: randomUUID() }));

    await expect(cache.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: entity.id }),
        expect.objectContaining({ id: keyRSA.id }),
      ]),
    );
  });

  test("should destroy", async () => {
    const destroy = await cache.create(
      new StoredKeySet({
        algorithm: "RS256",
        privateKey: "destroy",
        publicKey: "destroy",
        type: "RSA",
        use: "sig",
      }),
    );

    await expect(cache.destroy(destroy)).resolves.toBeUndefined();
    await expect(cache.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
