import { Logger } from "@lindorm-io/core-logger";
import { StoredKeySet, StoredKeySetAttributes } from "@lindorm-io/keystore";
import { IRedisConnection, RedisRepositoryBase } from "@lindorm-io/redis";

export class StoredKeySetRedisRepository extends RedisRepositoryBase<
  StoredKeySetAttributes,
  StoredKeySet
> {
  public constructor(connection: IRedisConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "StoredKeySet",
      indexedAttributes: ["algorithm", "type", "use"],
      ttlAttribute: "expiresAt",
    });
  }

  protected createDocument(entity: StoredKeySet): StoredKeySetAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: StoredKeySetAttributes): StoredKeySet {
    return new StoredKeySet(data);
  }

  protected validateSchema(entity: StoredKeySet): Promise<void> {
    return entity.schemaValidation();
  }
}
