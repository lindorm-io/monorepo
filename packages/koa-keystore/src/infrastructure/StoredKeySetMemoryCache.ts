import { Logger } from "@lindorm-io/core-logger";
import { IMemoryDatabase, MemoryCacheBase } from "@lindorm-io/in-memory-cache";
import { StoredKeySet, StoredKeySetAttributes } from "@lindorm-io/keystore";

export class StoredKeySetMemoryCache extends MemoryCacheBase<StoredKeySetAttributes, StoredKeySet> {
  public constructor(database: IMemoryDatabase, logger: Logger) {
    super(database, logger, {
      entityName: "StoredKeySet",
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
