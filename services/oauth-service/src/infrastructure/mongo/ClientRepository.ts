import { Client, ClientAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class ClientRepository extends MongoRepositoryBase<ClientAttributes, Client> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Client",
      indices: [],
    });
  }

  protected createDocument(entity: Client): ClientAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ClientAttributes): Client {
    return new Client(data);
  }

  protected validateSchema(entity: Client): Promise<void> {
    return entity.schemaValidation();
  }
}
