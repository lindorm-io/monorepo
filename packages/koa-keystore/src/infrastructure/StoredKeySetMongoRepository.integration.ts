import { createMockLogger } from "@lindorm-io/core-logger";
import { EntityNotFoundError } from "@lindorm-io/entity";
import {
  createTestStoredKeySet,
  createTestStoredKeySetRsa,
  StoredKeySet,
} from "@lindorm-io/keystore";
import { MongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { StoredKeySetMongoRepository } from "./StoredKeySetMongoRepository";

MockDate.set("2022-01-01T08:00:00.000Z");

describe("StoredKeySetRepository", () => {
  let repository: StoredKeySetMongoRepository;
  let connection: MongoConnection;
  let entity: StoredKeySet;

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

    repository = new StoredKeySetMongoRepository(connection, logger);
  });

  beforeEach(async () => {
    entity = await repository.create(createTestStoredKeySet({ id: randomUUID() }));
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should create", async () => {
    await expect(
      repository.create(
        createTestStoredKeySet({
          id: randomUUID(),
          expiresAt: new Date("2022-01-01T08:15:00.000Z"),
        }),
      ),
    ).resolves.toStrictEqual(expect.any(StoredKeySet));
  });

  test("should update", async () => {
    entity.webKeySet.expiresAt = new Date("2099-01-01T08:00:00.000Z");

    await expect(repository.update(entity)).resolves.toStrictEqual(
      expect.objectContaining({
        id: entity.id,
        updated: new Date("2022-01-01T08:00:00.000Z"),
      }),
    );
  });

  test("should find", async () => {
    await expect(repository.find({ id: entity.id })).resolves.toStrictEqual(
      expect.objectContaining({ id: entity.id }),
    );
  });

  test("should find many", async () => {
    const keyRSA = await repository.create(createTestStoredKeySetRsa({ id: randomUUID() }));

    await expect(repository.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: entity.id }),
        expect.objectContaining({ id: keyRSA.id }),
      ]),
    );
  });

  test("should destroy", async () => {
    const destroy = await repository.create(
      new StoredKeySet({
        algorithm: "RS256",
        privateKey: "destroy",
        publicKey: "destroy",
        type: "RSA",
        use: "sig",
      }),
    );

    await expect(repository.destroy(destroy)).resolves.toBeUndefined();
    await expect(repository.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
