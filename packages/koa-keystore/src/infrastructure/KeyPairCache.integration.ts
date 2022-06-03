import { Algorithm, KeyPair, KeyType } from "@lindorm-io/key-pair";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { KeyPairCache } from "./KeyPairCache";
import { RedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestKeyPairEC, getTestKeyPairRSA } from "../test";

describe("KeyPairCache", () => {
  let cache: KeyPairCache;
  let connection: RedisConnection;
  let entity: KeyPair;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6379,
      winston: logger,
    });

    await connection.waitForConnection();

    cache = new KeyPairCache({ connection, logger });
  });

  beforeEach(async () => {
    entity = await cache.create(getTestKeyPairEC());
  });

  afterAll(async () => {
    await connection.quit();
  });

  test("should create", async () => {
    await expect(
      cache.create(
        new KeyPair({
          algorithms: [Algorithm.RS256],
          passphrase: "",
          privateKey: "create",
          publicKey: "create",
          type: KeyType.RSA,
        }),
      ),
    ).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should update", async () => {
    entity.expires = new Date("2099-01-01T08:00:00.000Z");

    await expect(cache.update(entity)).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should find", async () => {
    await expect(cache.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    const keyRSA = await cache.create(getTestKeyPairRSA());

    await expect(cache.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([entity, keyRSA]),
    );
  });

  test("should destroy", async () => {
    const destroy = await cache.create(
      new KeyPair({
        algorithms: [Algorithm.RS256],
        passphrase: "",
        privateKey: "destroy",
        publicKey: "destroy",
        type: KeyType.RSA,
      }),
    );

    await expect(cache.destroy(destroy)).resolves.toBeUndefined();
    await expect(cache.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
