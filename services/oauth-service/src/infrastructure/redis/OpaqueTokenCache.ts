import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { OpaqueToken, OpaqueTokenAttributes } from "../../entity";

export class OpaqueTokenCache extends RedisRepositoryBase<OpaqueTokenAttributes, OpaqueToken> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "OpaqueToken",
      indexedAttributes: ["clientSessionId", "type"],
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
