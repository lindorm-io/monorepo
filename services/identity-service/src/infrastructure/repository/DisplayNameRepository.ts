import { DisplayName, DisplayNameAttributes } from "../../entity";
import { LindormRepository, RepositoryOptions } from "@lindorm-io/mongo";

export class DisplayNameRepository extends LindormRepository<DisplayNameAttributes, DisplayName> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "display_name",
      indices: [
        {
          index: { name: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createEntity(data: DisplayNameAttributes): DisplayName {
    return new DisplayName(data);
  }
}
