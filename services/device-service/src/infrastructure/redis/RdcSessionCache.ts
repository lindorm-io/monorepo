import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { RdcSession, RdcSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class RdcSessionCache extends RedisRepositoryBase<RdcSessionAttributes, RdcSession> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "RdcSession",
      indexedAttributes: ["identityId"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: RdcSession): RdcSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: RdcSession): RdcSession {
    return new RdcSession(data);
  }

  protected validateSchema(entity: RdcSession): Promise<void> {
    return entity.schemaValidation();
  }
}
