import { RefreshSessionAttributes, RefreshSession } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class RefreshSessionRepository extends LindormRepository<
  RefreshSessionAttributes,
  RefreshSession
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "refresh_session",
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
            expires: 1,
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
      ],
    });
  }

  protected createEntity(data: RefreshSessionAttributes): RefreshSession {
    return new RefreshSession(data);
  }
}
