import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import {
  AuthenticationConfirmationToken,
  AuthenticationConfirmationTokenAttributes,
} from "../../entity";

export class AuthenticationConfirmationTokenCache extends RedisRepositoryBase<
  AuthenticationConfirmationTokenAttributes,
  AuthenticationConfirmationToken
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "AuthenticationConfirmationToken",
      indexedAttributes: ["token"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(
    entity: AuthenticationConfirmationToken,
  ): AuthenticationConfirmationTokenAttributes {
    return entity.toJSON();
  }

  protected createEntity(
    data: AuthenticationConfirmationTokenAttributes,
  ): AuthenticationConfirmationToken {
    return new AuthenticationConfirmationToken(data);
  }

  protected validateSchema(entity: AuthenticationConfirmationToken): Promise<void> {
    return entity.schemaValidation();
  }
}
