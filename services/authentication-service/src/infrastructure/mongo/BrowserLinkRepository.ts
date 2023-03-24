import { BrowserLink, BrowserLinkAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class BrowserLinkRepository extends MongoRepositoryBase<BrowserLinkAttributes, BrowserLink> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "BrowserLink",
      indices: [],
    });
  }

  protected createDocument(entity: BrowserLink): BrowserLinkAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: BrowserLinkAttributes): BrowserLink {
    return new BrowserLink(data);
  }

  protected validateSchema(entity: BrowserLink): Promise<void> {
    return entity.schemaValidation();
  }
}
