import { ExternalIdentifierAttributes, ExternalIdentifier } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class ExternalIdentifierRepository extends LindormRepository<
  ExternalIdentifierAttributes,
  ExternalIdentifier
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "external_identifier",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { identifier: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createEntity(data: ExternalIdentifierAttributes): ExternalIdentifier {
    return new ExternalIdentifier(data);
  }
}
