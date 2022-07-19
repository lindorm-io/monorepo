import { ProtectedRecordAttributes, ProtectedRecord } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class ProtectedRecordRepository extends LindormRepository<
  ProtectedRecordAttributes,
  ProtectedRecord
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "protected_record",
      indices: [],
    });
  }

  protected createEntity(data: ProtectedRecordAttributes): ProtectedRecord {
    return new ProtectedRecord(data);
  }
}
