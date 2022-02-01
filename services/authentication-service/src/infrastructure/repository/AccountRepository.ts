import { AccountAttributes, Account } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class AccountRepository extends LindormRepository<AccountAttributes, Account> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "account",
      indices: [],
    });
  }

  protected createEntity(data: AccountAttributes): Account {
    return new Account(data);
  }
}
