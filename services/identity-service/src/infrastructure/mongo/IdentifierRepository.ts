import { Identifier, IdentifierAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class IdentifierRepository extends MongoRepositoryBase<IdentifierAttributes, Identifier> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Identifier",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { provider: 1, type: 1, value: 1 },
          options: { unique: false },
        },
        {
          index: { identityId: 1, provider: 1, type: 1, value: 1 },
          options: { unique: true },
        },
        {
          index: { identityId: 1, provider: 1, type: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createDocument(entity: Identifier): IdentifierAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: IdentifierAttributes): Identifier {
    return new Identifier(data);
  }

  protected validateSchema(entity: Identifier): Promise<void> {
    return entity.schemaValidation();
  }
}
