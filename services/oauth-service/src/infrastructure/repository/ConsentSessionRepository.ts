import { ConsentSessionAttributes, ConsentSession } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class ConsentSessionRepository extends LindormRepository<
  ConsentSessionAttributes,
  ConsentSession
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "consent_session",
      indices: [
        {
          index: {
            identityId: 1,
          },
          options: {
            unique: false,
          },
        },
        {
          index: {
            clientId: 1,
            identityId: 1,
          },
          options: {
            name: "idx_consent_session_client_id_identity_id",
            unique: true,
          },
        },
      ],
    });
  }

  protected createEntity(data: ConsentSessionAttributes): ConsentSession {
    return new ConsentSession(data);
  }
}
