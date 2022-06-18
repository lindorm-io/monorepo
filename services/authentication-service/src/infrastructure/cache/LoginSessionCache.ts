import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { LoginSessionAttributes, LoginSession } from "../../entity";

export class LoginSessionCache extends LindormCache<LoginSessionAttributes, LoginSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "LoginSession",
      indexedAttributes: ["authenticationSessionId"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: LoginSessionAttributes): LoginSession {
    return new LoginSession(data);
  }
}
