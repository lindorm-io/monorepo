import { EncryptedRecordAttributes, EncryptedRecord } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class EncryptedRecordRepository extends LindormRepository<
  EncryptedRecordAttributes,
  EncryptedRecord
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "encrypted_record",
      indices: [],
    });
  }

  protected createEntity(data: EncryptedRecordAttributes): EncryptedRecord {
    return new EncryptedRecord(data);
  }
}
