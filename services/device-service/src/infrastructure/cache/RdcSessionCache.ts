import { LindormCache, CacheOptions } from "@lindorm-io/redis";
import { RdcSession, RdcSessionAttributes } from "../../entity";

export class RdcSessionCache extends LindormCache<RdcSessionAttributes, RdcSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "RdcSession",
      indexedAttributes: ["identityId"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: RdcSession): RdcSession {
    return new RdcSession(data);
  }
}
