import { PhoneNumberAttributes, PhoneNumber } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class PhoneNumberRepository extends LindormRepository<PhoneNumberAttributes, PhoneNumber> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "phone_number",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { phoneNumber: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createEntity(data: PhoneNumberAttributes): PhoneNumber {
    return new PhoneNumber(data);
  }
}
