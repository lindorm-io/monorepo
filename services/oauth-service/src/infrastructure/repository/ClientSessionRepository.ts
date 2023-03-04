import { ClientSession, ClientSessionAttributes } from "../../entity";
import { LindormRepository, RepositoryOptions } from "@lindorm-io/mongo";

export class ClientSessionRepository extends LindormRepository<
  ClientSessionAttributes,
  ClientSession
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "client_session",
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
            identityId: 1,
          },
          options: {
            unique: false,
          },
        },
        {
          index: {
            type: 1,
          },
          options: {
            unique: false,
          },
        },
      ],
    });
  }

  protected createEntity(data: ClientSessionAttributes): ClientSession {
    return new ClientSession(data);
  }
}
