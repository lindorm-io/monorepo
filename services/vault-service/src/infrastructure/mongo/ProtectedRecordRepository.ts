import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { ProtectedRecord, ProtectedRecordAttributes } from "../../entity";

export class ProtectedRecordRepository extends MongoRepositoryBase<
  ProtectedRecordAttributes,
  ProtectedRecord
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "ProtectedRecord",
      indices: [
        {
          index: { owner: 1, ownerType: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createDocument(entity: ProtectedRecord): ProtectedRecordAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ProtectedRecordAttributes): ProtectedRecord {
    return new ProtectedRecord(data);
  }

  protected validateSchema(entity: ProtectedRecord): Promise<void> {
    return entity.schemaValidation();
  }
}
