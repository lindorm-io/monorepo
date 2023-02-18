import { AccessSessionAttributes, AccessSession } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class AccessSessionRepository extends LindormRepository<
  AccessSessionAttributes,
  AccessSession
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "access_session",
      indices: [
        {
          index: {
            browserSessionId: 1,
            clientId: 1,
            identityId: 1,
          },
          options: {
            unique: true,
          },
        },

        {
          index: {
            browserSessionId: 1,
            clientId: 1,
          },
          options: {
            unique: false,
          },
        },
      ],
    });
  }

  protected createEntity(data: AccessSessionAttributes): AccessSession {
    return new AccessSession(data);
  }
}
