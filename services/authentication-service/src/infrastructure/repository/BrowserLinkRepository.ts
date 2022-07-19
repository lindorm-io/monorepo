import { BrowserLinkAttributes, BrowserLink } from "../../entity";
import { RepositoryOptions, LindormRepository } from "@lindorm-io/mongo";

export class BrowserLinkRepository extends LindormRepository<BrowserLinkAttributes, BrowserLink> {
  public constructor(options: RepositoryOptions) {
    super({
      ...options,
      collection: "browser_link",
      indices: [],
    });
  }

  protected createEntity(data: BrowserLinkAttributes): BrowserLink {
    return new BrowserLink(data);
  }
}
