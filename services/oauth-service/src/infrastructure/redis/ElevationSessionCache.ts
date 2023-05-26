import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { ElevationSession, ElevationSessionAttributes } from "../../entity";

export class ElevationSessionCache extends RedisRepositoryBase<
  ElevationSessionAttributes,
  ElevationSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "ElevationSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: ElevationSession): ElevationSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ElevationSessionAttributes): ElevationSession {
    return new ElevationSession(data);
  }

  protected validateSchema(entity: ElevationSession): Promise<void> {
    return entity.schemaValidation();
  }
}
