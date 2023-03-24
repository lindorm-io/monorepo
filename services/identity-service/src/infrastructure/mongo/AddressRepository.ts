import { Address, AddressAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class AddressRepository extends MongoRepositoryBase<AddressAttributes, Address> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Address",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { identityId: 1, primary: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createDocument(entity: Address): AddressAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AddressAttributes): Address {
    return new Address(data);
  }

  protected validateSchema(entity: Address): Promise<void> {
    return entity.schemaValidation();
  }
}
