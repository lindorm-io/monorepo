import { ClaimsSession, ClaimsSessionAttributes } from "../../entity";
import { CacheOptions, LindormCache } from "@lindorm-io/redis";

export class ClaimsSessionCache extends LindormCache<ClaimsSessionAttributes, ClaimsSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "ClaimsSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: ClaimsSessionAttributes): ClaimsSession {
    return new ClaimsSession(data);
  }
}
