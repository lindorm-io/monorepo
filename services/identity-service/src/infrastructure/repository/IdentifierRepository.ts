import { IdentifierAttributes, Identifier } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class IdentifierRepository extends LindormRepository<IdentifierAttributes, Identifier> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "identifier",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { identifier: 1, provider: 1, type: 1 },
          options: { unique: false },
        },
        {
          index: { identifier: 1, identityId: 1, provider: 1, type: 1 },
          options: { unique: true },
        },
        {
          index: { identityId: 1, provider: 1, type: 1 },
          options: { unique: false },
        },
      ],
    });
  }

  protected createEntity(data: IdentifierAttributes): Identifier {
    return new Identifier(data);
  }
}
