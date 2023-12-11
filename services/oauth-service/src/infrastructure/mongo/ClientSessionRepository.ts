import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { ClientSession, ClientSessionAttributes } from "../../entity";

export class ClientSessionRepository extends MongoRepositoryBase<
  ClientSessionAttributes,
  ClientSession
> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: ClientSession.name,
      indices: [
        {
          index: {
            clientId: 1,
          },
          options: {
            unique: false,
          },
        },
        {
          index: {
            identityId: 1,
          },
          options: {
            unique: false,
          },
        },
        {
          index: {
            type: 1,
          },
          options: {
            unique: false,
          },
        },
      ],
    });
  }

  protected createDocument(entity: ClientSession): ClientSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ClientSessionAttributes): ClientSession {
    return new ClientSession(data);
  }

  protected validateSchema(entity: ClientSession): Promise<void> {
    return entity.schemaValidation();
  }
}
