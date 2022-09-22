import { AuthorizationCodeAttributes, AuthorizationCode } from "../../entity";
import { CacheOptions, LindormCache } from "@lindorm-io/redis";

export class AuthorizationCodeCache extends LindormCache<
  AuthorizationCodeAttributes,
  AuthorizationCode
> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "AuthorizationCode",
      indexedAttributes: ["code"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: AuthorizationCodeAttributes): AuthorizationCode {
    return new AuthorizationCode(data);
  }
}
