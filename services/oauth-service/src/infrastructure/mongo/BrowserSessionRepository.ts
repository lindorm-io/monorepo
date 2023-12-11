import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { BrowserSession, BrowserSessionAttributes } from "../../entity";

export class BrowserSessionRepository extends MongoRepositoryBase<
  BrowserSessionAttributes,
  BrowserSession
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: BrowserSession.name,
      indices: [
        {
          index: {
            identityId: 1,
          },
          options: {
            unique: false,
          },
        },
      ],
    });
  }

  protected createDocument(entity: BrowserSession): BrowserSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: BrowserSessionAttributes): BrowserSession {
    return new BrowserSession(data);
  }

  protected validateSchema(entity: BrowserSession): Promise<void> {
    return entity.schemaValidation();
  }
}
