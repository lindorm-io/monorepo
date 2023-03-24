import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { MfaCookieSession, MfaCookieSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class MfaCookieSessionCache extends RedisRepositoryBase<
  MfaCookieSessionAttributes,
  MfaCookieSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "MfaCookieSession",
      indexedAttributes: ["identityId"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: MfaCookieSession): MfaCookieSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: MfaCookieSessionAttributes): MfaCookieSession {
    return new MfaCookieSession(data);
  }

  protected validateSchema(entity: MfaCookieSession): Promise<void> {
    return entity.schemaValidation();
  }
}
