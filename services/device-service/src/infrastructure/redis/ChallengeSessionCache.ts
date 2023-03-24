import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { ChallengeSession, ChallengeSessionAttributes } from "../../entity";
import { Logger } from "@lindorm-io/core-logger";

export class ChallengeSessionCache extends RedisRepositoryBase<
  ChallengeSessionAttributes,
  ChallengeSession
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "ChallengeSession",
      indexedAttributes: [],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: ChallengeSession): ChallengeSessionAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: ChallengeSession): ChallengeSession {
    return new ChallengeSession(data);
  }

  protected validateSchema(entity: ChallengeSession): Promise<void> {
    return entity.schemaValidation();
  }
}
