import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { BackchannelSession, BackchannelSessionAttributes } from "../../entity";

export class BackchannelSessionCache extends RedisRepositoryBase<
  BackchannelSessionAttributes,
  BackchannelSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: BackchannelSession.name,
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: BackchannelSession): BackchannelSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: BackchannelSessionAttributes): BackchannelSession {
    return new BackchannelSession(data);
  }

  protected validateSchema(entity: BackchannelSession): Promise<void> {
    return entity.schemaValidation();
  }
}
