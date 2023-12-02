import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { PublicKey, PublicKeyAttributes } from "../../entity";

export class PublicKeyRepository extends MongoRepositoryBase<PublicKeyAttributes, PublicKey> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "PublicKey",
      indices: [],
    });
  }

  protected createDocument(entity: PublicKey): PublicKeyAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: PublicKeyAttributes): PublicKey {
    return new PublicKey(data);
  }

  protected validateSchema(entity: PublicKey): Promise<void> {
    return entity.schemaValidation();
  }
}
