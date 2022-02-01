import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { ClientAttributes, Client } from "../../entity";

export class ClientCache extends LindormCache<ClientAttributes, Client> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "Client",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: ClientAttributes): Client {
    return new Client(data);
  }
}
