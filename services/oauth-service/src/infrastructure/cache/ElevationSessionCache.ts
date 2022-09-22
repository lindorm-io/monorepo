import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { ElevationSessionAttributes, ElevationSession } from "../../entity";

export class ElevationSessionCache extends LindormCache<
  ElevationSessionAttributes,
  ElevationSession
> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "ElevationSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: ElevationSessionAttributes): ElevationSession {
    return new ElevationSession(data);
  }
}
