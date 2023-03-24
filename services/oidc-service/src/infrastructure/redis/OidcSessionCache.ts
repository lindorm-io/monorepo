import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { OidcSession, OidcSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class OidcSessionCache extends RedisRepositoryBase<OidcSessionAttributes, OidcSession> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "OidcSession",
      indexedAttributes: ["state"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: OidcSession): OidcSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: OidcSessionAttributes): OidcSession {
    return new OidcSession(data);
  }

  protected validateSchema(entity: OidcSession): Promise<void> {
    return entity.schemaValidation();
  }
}
