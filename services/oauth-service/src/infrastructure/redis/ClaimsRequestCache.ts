import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { ClaimsRequest, ClaimsRequestAttributes } from "../../entity";

export class ClaimsRequestCache extends RedisRepositoryBase<
  ClaimsRequestAttributes,
  ClaimsRequest
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "ClaimsRequest",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: ClaimsRequest): ClaimsRequestAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ClaimsRequestAttributes): ClaimsRequest {
    return new ClaimsRequest(data);
  }

  protected validateSchema(entity: ClaimsRequest): Promise<void> {
    return entity.schemaValidation();
  }
}
