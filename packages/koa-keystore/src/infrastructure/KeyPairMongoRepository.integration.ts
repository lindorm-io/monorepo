import { createMockLogger } from "@lindorm-io/core-logger";
import { EntityNotFoundError } from "@lindorm-io/entity";
import {
  createTestKeyPair,
  createTestKeyPairRSA,
  KeyPair,
  KeyPairAlgorithm,
  KeyPairType,
} from "@lindorm-io/key-pair";
import { MongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";
import { KeyPairMongoRepository } from "./KeyPairMongoRepository";

describe("KeyPairRepository", () => {
  let repository: KeyPairMongoRepository;
  let connection: MongoConnection;
  let entity: KeyPair;

  const logger = createMockLogger();

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5006,
        database: "database",
        auth: { username: "root", password: "example" },
      },
      logger,
    );

    await connection.connect();

    repository = new KeyPairMongoRepository(connection, logger);
  });

  beforeEach(async () => {
    entity = await repository.create(createTestKeyPair({ id: randomUUID() }));
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should create", async () => {
    await expect(
      repository.create(
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

  test("should update", async () => {
    entity.expiresAt = new Date("2099-01-01T08:00:00.000Z");

    await expect(repository.update(entity)).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should find", async () => {
    await expect(repository.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    const keyRSA = await repository.create(createTestKeyPairRSA());

    await expect(repository.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([entity, keyRSA]),
    );
  });

  test("should destroy", async () => {
    const destroy = await repository.create(
      new KeyPair({
        algorithms: [KeyPairAlgorithm.RS256],
        passphrase: "",
        privateKey: "destroy",
        publicKey: "destroy",
        type: KeyPairType.RSA,
      }),
    );

    await expect(repository.destroy(destroy)).resolves.toBeUndefined();
    await expect(repository.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
