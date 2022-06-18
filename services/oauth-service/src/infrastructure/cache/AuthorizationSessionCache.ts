import { AuthorizationSessionAttributes, AuthorizationSession } from "../../entity";
import { CacheOptions, LindormCache } from "@lindorm-io/redis";

export class AuthorizationSessionCache extends LindormCache<
  AuthorizationSessionAttributes,
  AuthorizationSession
> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "AuthorizationSession",
      indexedAttributes: ["code"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: AuthorizationSessionAttributes): AuthorizationSession {
    return new AuthorizationSession(data);
  }
}
