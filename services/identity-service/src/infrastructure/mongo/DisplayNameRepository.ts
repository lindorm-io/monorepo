import { DisplayName, DisplayNameAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class DisplayNameRepository extends MongoRepositoryBase<DisplayNameAttributes, DisplayName> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "DisplayName",
      indices: [
        {
          index: { name: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createDocument(entity: DisplayName): DisplayNameAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: DisplayNameAttributes): DisplayName {
    return new DisplayName(data);
  }

  protected validateSchema(entity: DisplayName): Promise<void> {
    return entity.schemaValidation();
  }
}
