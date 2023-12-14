import { createMockLogger } from "@lindorm-io/core-logger";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { MemoryDatabase } from "@lindorm-io/in-memory-cache";
import {
  createTestKeyPair,
  createTestKeyPairRSA,
  KeyPair,
  KeyPairAlgorithm,
  KeyPairType,
} from "@lindorm-io/key-pair";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { KeyPairMemoryCache } from "./KeyPairMemoryCache";

MockDate.set("2022-01-01T08:00:00.000Z");

describe("KeyPairMemory", () => {
  let database: MemoryDatabase;
  let cache: KeyPairMemoryCache;
  let entity: KeyPair;

  const logger = createMockLogger();

  beforeAll(async () => {
    database = new MemoryDatabase();
    cache = new KeyPairMemoryCache(database, logger);
  });

  beforeEach(async () => {
    entity = await cache.create(
      createTestKeyPair({ id: randomUUID(), expiresAt: new Date("2022-01-01T08:15:00.000Z") }),
    );
  });

  test("should create", async () => {
    await expect(
      cache.create(
        new KeyPair({
          algorithms: [KeyPairAlgorithm.RS256],
          passphrase: "",
          privateKey: "create",
          publicKey: "create",
          type: KeyPairType.RSA,
        }),
      ),
    ).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should update with expiry", async () => {
    entity.expiresAt = new Date("2022-01-01T08:30:00.000Z");

    await expect(cache.update(entity)).resolves.toStrictEqual(expect.any(KeyPair));
    await expect(cache.ttl(entity)).resolves.toBe(1800);
  });

  test("should find", async () => {
    await expect(cache.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    const keyRSA = await cache.create(createTestKeyPairRSA());

    await expect(cache.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([entity, keyRSA]),
    );
  });

  test("should destroy", async () => {
    const destroy = await cache.create(
      new KeyPair({
        algorithms: [KeyPairAlgorithm.RS256],
        passphrase: "",
        privateKey: "destroy",
        publicKey: "destroy",
        type: KeyPairType.RSA,
      }),
    );

    await expect(cache.destroy(destroy)).resolves.toBeUndefined();
    await expect(cache.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
