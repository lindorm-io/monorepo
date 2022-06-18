import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { StrategySessionAttributes, StrategySession } from "../../entity";

export class StrategySessionCache extends LindormCache<StrategySessionAttributes, StrategySession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "StrategySession",
      indexedAttributes: ["authenticationSessionId"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: StrategySessionAttributes): StrategySession {
    return new StrategySession(data);
  }
}
