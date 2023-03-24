import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { AuthenticationSession, AuthenticationSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class AuthenticationSessionCache extends RedisRepositoryBase<
  AuthenticationSessionAttributes,
  AuthenticationSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "AuthenticationSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: AuthenticationSession): AuthenticationSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AuthenticationSessionAttributes): AuthenticationSession {
    return new AuthenticationSession(data);
  }

  protected validateSchema(entity: AuthenticationSession): Promise<void> {
    return entity.schemaValidation();
  }
}
