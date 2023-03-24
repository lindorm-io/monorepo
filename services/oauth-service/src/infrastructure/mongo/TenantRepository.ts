import { Tenant, TenantAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class TenantRepository extends MongoRepositoryBase<TenantAttributes, Tenant> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Tenant",
      indices: [],
    });
  }

  protected createDocument(entity: Tenant): TenantAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: TenantAttributes): Tenant {
    return new Tenant(data);
  }

  protected validateSchema(entity: Tenant): Promise<void> {
    return entity.schemaValidation();
  }
}
