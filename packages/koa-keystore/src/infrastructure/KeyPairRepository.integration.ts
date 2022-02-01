import { EntityNotFoundError } from "@lindorm-io/entity";
import { Algorithm, KeyPair, KeyType } from "@lindorm-io/key-pair";
import { KeyPairRepository } from "./KeyPairRepository";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { getTestKeyPairEC, getTestKeyPairRSA } from "../test";

describe("KeyPairRepository", () => {
  let repository: KeyPairRepository;
  let connection: MongoConnection;
  let entity: KeyPair;

  beforeAll(async () => {
    const logger = new Logger();
    logger.addConsole(LogLevel.ERROR);

    connection = new MongoConnection({
      host: "localhost",
      port: 27017,
      auth: { username: "root", password: "example" },
      database: "databaseName",
      winston: logger,
    });

    await connection.waitForConnection();

    repository = new KeyPairRepository({
      db: connection.database(),
      logger,
    });
  });

  beforeEach(async () => {
    entity = await repository.create(getTestKeyPairEC());
  });

  afterAll(async () => {
    await connection.close();
  });

  test("should create", async () => {
    await expect(
      repository.create(
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

    await expect(repository.update(entity)).resolves.toStrictEqual(expect.any(KeyPair));
  });

  test("should find", async () => {
    await expect(repository.find({ id: entity.id })).resolves.toStrictEqual(entity);
  });

  test("should find many", async () => {
    const keyRSA = await repository.create(getTestKeyPairRSA());

    await expect(repository.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([entity, keyRSA]),
    );
  });

  test("should destroy", async () => {
    const destroy = await repository.create(
      new KeyPair({
        algorithms: [Algorithm.RS256],
        passphrase: "",
        privateKey: "destroy",
        publicKey: "destroy",
        type: KeyType.RSA,
      }),
    );

    await expect(repository.destroy(destroy)).resolves.toBeUndefined();
    await expect(repository.find({ id: destroy.id })).rejects.toThrow(EntityNotFoundError);
  });
});
