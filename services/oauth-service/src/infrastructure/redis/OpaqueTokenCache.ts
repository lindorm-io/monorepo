import { OpaqueToken, OpaqueTokenAttributes } from "../../entity";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { Logger } from "@lindorm-io/core-logger";

export class OpaqueTokenCache extends RedisRepositoryBase<OpaqueTokenAttributes, OpaqueToken> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "OpaqueToken",
      indexedAttributes: ["clientSessionId", "token", "type"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: OpaqueToken): OpaqueTokenAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: OpaqueTokenAttributes): OpaqueToken {
    return new OpaqueToken(data);
  }

  protected validateSchema(entity: OpaqueToken): Promise<void> {
    return entity.schemaValidation();
  }
}
