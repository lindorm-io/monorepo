import { EmailAttributes, Email } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class EmailRepository extends LindormRepository<EmailAttributes, Email> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collectionName: "email",
      indices: [
        {
          index: { identityId: 1 },
          options: { unique: false },
        },
        {
          index: { email: 1 },
          options: { unique: true },
        },
      ],
    });
  }

  protected createEntity(data: EmailAttributes): Email {
    return new Email(data);
  }
}
