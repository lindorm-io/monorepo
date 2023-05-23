import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { ElevationRequest, ElevationRequestAttributes } from "../../entity";

export class ElevationRequestCache extends RedisRepositoryBase<
  ElevationRequestAttributes,
  ElevationRequest
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "ElevationRequest",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: ElevationRequest): ElevationRequestAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ElevationRequestAttributes): ElevationRequest {
    return new ElevationRequest(data);
  }

  protected validateSchema(entity: ElevationRequest): Promise<void> {
    return entity.schemaValidation();
  }
}
