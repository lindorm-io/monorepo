import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { FederationSession, FederationSessionAttributes } from "../../entity";

export class FederationSessionCache extends RedisRepositoryBase<
  FederationSessionAttributes,
  FederationSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "FederationSession",
      indexedAttributes: ["state"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: FederationSession): FederationSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: FederationSessionAttributes): FederationSession {
    return new FederationSession(data);
  }

  protected validateSchema(entity: FederationSession): Promise<void> {
    return entity.schemaValidation();
  }
}
