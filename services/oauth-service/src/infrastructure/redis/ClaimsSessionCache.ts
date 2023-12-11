import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { ClaimsSession, ClaimsSessionAttributes } from "../../entity";

export class ClaimsSessionCache extends RedisRepositoryBase<
  ClaimsSessionAttributes,
  ClaimsSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: ClaimsSession.name,
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: ClaimsSession): ClaimsSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ClaimsSessionAttributes): ClaimsSession {
    return new ClaimsSession(data);
  }

  protected validateSchema(entity: ClaimsSession): Promise<void> {
    return entity.schemaValidation();
  }
}
