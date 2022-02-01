import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { ConnectSessionAttributes, ConnectSession } from "../../entity";

export class ConnectSessionCache extends LindormCache<ConnectSessionAttributes, ConnectSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "ConnectSession",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: ConnectSessionAttributes): ConnectSession {
    return new ConnectSession(data);
  }
}
