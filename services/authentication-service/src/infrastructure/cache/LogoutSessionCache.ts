import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { LogoutSessionAttributes, LogoutSession } from "../../entity";

export class LogoutSessionCache extends LindormCache<LogoutSessionAttributes, LogoutSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "LogoutSession",
      indexedAttributes: [],
    });
  }

  protected createEntity(data: LogoutSessionAttributes): LogoutSession {
    return new LogoutSession(data);
  }
}
