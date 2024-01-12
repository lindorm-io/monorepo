import { Logger } from "@lindorm-io/core-logger";
import { StoredKeySet, StoredKeySetAttributes } from "@lindorm-io/keystore";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";

export class StoredKeySetMongoRepository extends MongoRepositoryBase<
  StoredKeySetAttributes,
  StoredKeySet
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "StoredKeySet",
      indices: [
        {
          index: { algorithm: 1 },
          options: { unique: false },
        },
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
          index: { type: 1 },
          options: { unique: false },
        },
        {
          index: { use: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createDocument(entity: StoredKeySet): StoredKeySetAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: StoredKeySetAttributes): StoredKeySet {
    return new StoredKeySet(data);
  }

  protected validateSchema(entity: StoredKeySet): Promise<void> {
    return entity.schemaValidation();
  }
}
