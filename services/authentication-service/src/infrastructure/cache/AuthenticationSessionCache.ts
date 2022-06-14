import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { AuthenticationSessionAttributes, AuthenticationSession } from "../../entity";

export class AuthenticationSessionCache extends LindormCache<
  AuthenticationSessionAttributes,
  AuthenticationSession
> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "AuthenticationSession",
      indexedAttributes: ["loginSessionId"],
    });
  }

  protected createEntity(data: AuthenticationSessionAttributes): AuthenticationSession {
    return new AuthenticationSession(data);
  }
}
