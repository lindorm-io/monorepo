import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";
import { KeyPair, KeyPairAttributes } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/core-logger";

export class KeyPairRedisRepository extends RedisRepositoryBase<KeyPairAttributes, KeyPair> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "KeyPair",
      indexedAttributes: ["type"],
      ttlAttribute: "expires",
    });
  }

  protected createDocument(entity: KeyPair): KeyPairAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: KeyPairAttributes): KeyPair {
    return new KeyPair(data);
  }

  protected validateSchema(entity: KeyPair): Promise<void> {
    return entity.schemaValidation();
  }
}
