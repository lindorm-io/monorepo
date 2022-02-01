import { Identity, IdentityAttributes } from "../../entity";
import { LindormRepository, RepositoryOptions } from "@lindorm-io/mongo";

export class IdentityRepository extends LindormRepository<IdentityAttributes, Identity> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "identity",
      indices: [
        {
          index: { nationalIdentityNumber: 1 },
          options: {
            partialFilterExpression: { nationalIdentityNumber: { $gt: "" } },
            unique: true,
          },
        },
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

  protected createEntity(data: IdentityAttributes): Identity {
    return new Identity(data);
  }
}
