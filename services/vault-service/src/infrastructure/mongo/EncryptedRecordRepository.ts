import { EncryptedRecord, EncryptedRecordAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class EncryptedRecordRepository extends MongoRepositoryBase<
  EncryptedRecordAttributes,
  EncryptedRecord
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "EncryptedRecord",
      indices: [],
    });
  }

  protected createDocument(entity: EncryptedRecord): EncryptedRecordAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: EncryptedRecordAttributes): EncryptedRecord {
    return new EncryptedRecord(data);
  }

  protected validateSchema(entity: EncryptedRecord): Promise<void> {
    return entity.schemaValidation();
  }
}
