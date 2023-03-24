import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { EnrolmentSession, EnrolmentSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class EnrolmentSessionCache extends RedisRepositoryBase<
  EnrolmentSessionAttributes,
  EnrolmentSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "EnrolmentSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: EnrolmentSession): EnrolmentSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: EnrolmentSession): EnrolmentSession {
    return new EnrolmentSession(data);
  }

  protected validateSchema(entity: EnrolmentSession): Promise<void> {
    return entity.schemaValidation();
  }
}
