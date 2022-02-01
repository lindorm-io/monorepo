import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { ConsentSessionAttributes, ConsentSession } from "../../entity";

export class ConsentSessionCache extends LindormCache<ConsentSessionAttributes, ConsentSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "ConsentSession",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: ConsentSessionAttributes): ConsentSession {
    return new ConsentSession(data);
  }
}
