import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { InvalidTokenAttributes, InvalidToken } from "../../entity";

export class InvalidTokenCache extends LindormCache<InvalidTokenAttributes, InvalidToken> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "InvalidToken",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: InvalidTokenAttributes): InvalidToken {
    return new InvalidToken(data);
  }
}
