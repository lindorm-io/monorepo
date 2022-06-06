import { AddressAttributes, Address } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class AddressRepository extends LindormRepository<AddressAttributes, Address> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "address",
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

  protected createEntity(data: AddressAttributes): Address {
    return new Address(data);
  }
}
