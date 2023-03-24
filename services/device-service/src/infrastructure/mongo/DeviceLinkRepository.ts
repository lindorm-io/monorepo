import { DeviceLink, DeviceLinkAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class DeviceLinkRepository extends MongoRepositoryBase<DeviceLinkAttributes, DeviceLink> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "DeviceLink",
      indices: [
        {
          index: {
            identityId: 1,
            uniqueId: 1,
          },
          options: {
            name: "unique_on_identity",
            unique: true,
          },
        },
      ],
    });
  }

  protected createDocument(entity: DeviceLink): DeviceLinkAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: DeviceLinkAttributes): DeviceLink {
    return new DeviceLink(data);
  }

  protected validateSchema(entity: DeviceLink): Promise<void> {
    return entity.schemaValidation();
  }
}
