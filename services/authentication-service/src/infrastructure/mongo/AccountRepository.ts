import { Account, AccountAttributes } from "../../entity";
import { IMongoConnection, MongoRepositoryBase } from "@lindorm-io/mongo";
import { Logger } from "@lindorm-io/core-logger";

export class AccountRepository extends MongoRepositoryBase<AccountAttributes, Account> {
  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger, {
      entityName: "Account",
      indices: [],
    });
  }

  protected createDocument(entity: Account): AccountAttributes {
    return entity.toJSON();
  }

  protected createEntity(data: AccountAttributes): Account {
    return new Account(data);
  }

  protected validateSchema(entity: Account): Promise<void> {
    return entity.schemaValidation();
  }
}
