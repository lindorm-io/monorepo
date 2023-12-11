import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { AuthorizationCode, AuthorizationCodeAttributes } from "../../entity";

export class AuthorizationCodeCache extends RedisRepositoryBase<
  AuthorizationCodeAttributes,
  AuthorizationCode
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: AuthorizationCode.name,
      indexedAttributes: ["code"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: AuthorizationCode): AuthorizationCodeAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AuthorizationCodeAttributes): AuthorizationCode {
    return new AuthorizationCode(data);
  }

  protected validateSchema(entity: AuthorizationCode): Promise<void> {
    return entity.schemaValidation();
  }
}
