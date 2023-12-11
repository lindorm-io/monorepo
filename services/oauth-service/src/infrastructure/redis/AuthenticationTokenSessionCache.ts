import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { AuthenticationTokenSession, AuthenticationTokenSessionAttributes } from "../../entity";

export class AuthenticationTokenSessionCache extends RedisRepositoryBase<
  AuthenticationTokenSessionAttributes,
  AuthenticationTokenSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: AuthenticationTokenSession.name,
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(
    entity: AuthenticationTokenSession,
  ): AuthenticationTokenSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AuthenticationTokenSessionAttributes): AuthenticationTokenSession {
    return new AuthenticationTokenSession(data);
  }

  protected validateSchema(entity: AuthenticationTokenSession): Promise<void> {
    return entity.schemaValidation();
  }
}
