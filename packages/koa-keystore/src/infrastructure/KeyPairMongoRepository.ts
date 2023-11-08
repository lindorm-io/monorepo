import { Logger } from "@lindorm-io/core-logger";
import { KeyPair, KeyPairAttributes } from "@lindorm-io/key-pair";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";

export class KeyPairMongoRepository extends MongoRepositoryBase<KeyPairAttributes, KeyPair> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "KeyPair",
      indices: [
        {
          index: { expiresAt: 1 },
          options: { unique: false },
        },
        {
          index: { isExternal: 1 },
          options: { unique: false },
        },
        {
          index: { notBefore: 1 },
          options: { unique: false },
        },
        {
          index: { preferredAlgorithm: 1 },
          options: { unique: false },
        },
        {
          index: { type: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createDocument(entity: KeyPair): KeyPairAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: KeyPairAttributes): KeyPair {
    return new KeyPair(data);
  }

  protected validateSchema(entity: KeyPair): Promise<void> {
    return entity.schemaValidation();
  }
}
