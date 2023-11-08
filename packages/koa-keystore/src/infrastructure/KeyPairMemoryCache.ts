import { Logger } from "@lindorm-io/core-logger";
import { IMemoryDatabase, MemoryCacheBase } from "@lindorm-io/in-memory-cache";
import { KeyPair, KeyPairAttributes } from "@lindorm-io/key-pair";

export class KeyPairMemoryCache extends MemoryCacheBase<KeyPairAttributes, KeyPair> {
  public constructor(database: IMemoryDatabase, logger: Logger) {
    super(database, logger, {
      entityName: "KeyPair",
      ttlAttribute: "expiresAt",
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
