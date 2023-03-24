import { AuthorizationSession, AuthorizationSessionAttributes } from "../../entity";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { Logger } from "@lindorm-io/core-logger";

export class AuthorizationSessionCache extends RedisRepositoryBase<
  AuthorizationSessionAttributes,
  AuthorizationSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "AuthorizationSession",
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
