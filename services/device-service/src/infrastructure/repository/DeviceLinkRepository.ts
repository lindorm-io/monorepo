import { DeviceLink, DeviceLinkAttributes } from "../../entity";
import { LindormRepository, RepositoryOptions } from "@lindorm-io/mongo";

export class DeviceLinkRepository extends LindormRepository<DeviceLinkAttributes, DeviceLink> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "deviceLink",
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

  protected createEntity(data: DeviceLinkAttributes): DeviceLink {
    return new DeviceLink(data);
  }
}
