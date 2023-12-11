import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { AuthorizationSession, AuthorizationSessionAttributes } from "../../entity";

export class AuthorizationSessionCache extends RedisRepositoryBase<
  AuthorizationSessionAttributes,
  AuthorizationSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: AuthorizationSession.name,
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: AuthorizationSession): AuthorizationSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AuthorizationSessionAttributes): AuthorizationSession {
    return new AuthorizationSession(data);
  }

  protected validateSchema(entity: AuthorizationSession): Promise<void> {
    return entity.schemaValidation();
  }
}
