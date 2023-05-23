import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { AuthorizationRequest, AuthorizationRequestAttributes } from "../../entity";

export class AuthorizationRequestCache extends RedisRepositoryBase<
  AuthorizationRequestAttributes,
  AuthorizationRequest
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "AuthorizationRequest",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: AuthorizationRequest): AuthorizationRequestAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AuthorizationRequestAttributes): AuthorizationRequest {
    return new AuthorizationRequest(data);
  }

  protected validateSchema(entity: AuthorizationRequest): Promise<void> {
    return entity.schemaValidation();
  }
}
