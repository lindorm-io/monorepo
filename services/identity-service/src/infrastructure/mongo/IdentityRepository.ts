import { Identity, IdentityAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class IdentityRepository extends MongoRepositoryBase<IdentityAttributes, Identity> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Identity",
      indices: [
        {
          index: { username: 1 },
          options: {
            partialFilterExpression: { username: { $gt: "" } },
            unique: true,
          },
        },
      ],
    });
  }

  protected createDocument(entity: Identity): IdentityAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: IdentityAttributes): Identity {
    return new Identity(data);
  }

  protected validateSchema(entity: Identity): Promise<void> {
    return entity.schemaValidation();
  }
}
