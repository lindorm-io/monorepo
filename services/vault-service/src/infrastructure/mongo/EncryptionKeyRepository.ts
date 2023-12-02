import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { EncryptionKey, EncryptionKeyAttributes } from "../../entity";

export class EncryptionKeyRepository extends MongoRepositoryBase<
  EncryptionKeyAttributes,
  EncryptionKey
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "EncryptionKey",
      indices: [
        {
          index: { owner: 1, ownerType: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createDocument(entity: EncryptionKey): EncryptionKeyAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: EncryptionKeyAttributes): EncryptionKey {
    return new EncryptionKey(data);
  }

  protected validateSchema(entity: EncryptionKey): Promise<void> {
    return entity.schemaValidation();
  }
}
