import { ClientAttributes, Client } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class ClientRepository extends LindormRepository<ClientAttributes, Client> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "client",
      indices: [],
    });
  }

  protected createEntity(data: ClientAttributes): Client {
    return new Client(data);
  }
}
