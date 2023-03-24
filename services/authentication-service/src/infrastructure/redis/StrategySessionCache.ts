import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { StrategySession, StrategySessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class StrategySessionCache extends RedisRepositoryBase<
  StrategySessionAttributes,
  StrategySession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "StrategySession",
      indexedAttributes: ["authenticationSessionId"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: StrategySession): StrategySessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: StrategySessionAttributes): StrategySession {
    return new StrategySession(data);
  }

  protected validateSchema(entity: StrategySession): Promise<void> {
    return entity.schemaValidation();
  }
}
