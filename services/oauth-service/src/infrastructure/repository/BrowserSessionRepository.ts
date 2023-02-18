import { BrowserSessionAttributes, BrowserSession } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class BrowserSessionRepository extends LindormRepository<
  BrowserSessionAttributes,
  BrowserSession
> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "browser_session",
      indices: [
        {
          index: {
            identityId: 1,
          },
          options: {
            unique: false,
          },
        },
      ],
    });
  }

  protected createEntity(data: BrowserSessionAttributes): BrowserSession {
    return new BrowserSession(data);
  }
}
