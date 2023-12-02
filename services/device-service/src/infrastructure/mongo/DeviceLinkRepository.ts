import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { DeviceLink, DeviceLinkAttributes } from "../../entity";

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
        {
          index: {
            publicKeyId: 1,
          },
          options: {
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
