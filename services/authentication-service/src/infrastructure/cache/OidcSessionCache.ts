import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { OidcSessionAttributes, OidcSession } from "../../entity";

export class OidcSessionCache extends LindormCache<OidcSessionAttributes, OidcSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "OidcSession",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: OidcSessionAttributes): OidcSession {
    return new OidcSession(data);
  }
}
