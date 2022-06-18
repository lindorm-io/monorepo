import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { MfaCookieSessionAttributes, MfaCookieSession } from "../../entity";

export class MfaCookieSessionCache extends LindormCache<
  MfaCookieSessionAttributes,
  MfaCookieSession
> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "MfaCookieSession",
      indexedAttributes: ["identityId"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: MfaCookieSessionAttributes): MfaCookieSession {
    return new MfaCookieSession(data);
  }
}
