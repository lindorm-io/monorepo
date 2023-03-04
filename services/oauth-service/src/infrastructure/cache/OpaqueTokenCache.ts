import { OpaqueToken, OpaqueTokenAttributes } from "../../entity";
import { CacheOptions, LindormCache } from "@lindorm-io/redis";

export class OpaqueTokenCache extends LindormCache<OpaqueTokenAttributes, OpaqueToken> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "OpaqueToken",
      indexedAttributes: ["clientSessionId", "token", "type"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: OpaqueTokenAttributes): OpaqueToken {
    return new OpaqueToken(data);
  }
}
