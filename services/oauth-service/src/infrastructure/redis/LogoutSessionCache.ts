import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { LogoutSession, LogoutSessionAttributes } from "../../entity";

export class LogoutSessionCache extends RedisRepositoryBase<
  LogoutSessionAttributes,
  LogoutSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: LogoutSession.name,
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: LogoutSession): LogoutSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: LogoutSessionAttributes): LogoutSession {
    return new LogoutSession(data);
  }

  protected validateSchema(entity: LogoutSession): Promise<void> {
    return entity.schemaValidation();
  }
}
