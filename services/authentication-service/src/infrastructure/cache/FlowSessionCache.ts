import { CacheOptions, LindormCache } from "@lindorm-io/redis";
import { FlowSessionAttributes, FlowSession } from "../../entity";

export class FlowSessionCache extends LindormCache<FlowSessionAttributes, FlowSession> {
  public constructor(options: CacheOptions) {
    super({
      ...options,
      entityName: "FlowSession",
      indexedAttributes: ["loginSessionId"],
    });
  }

  protected createEntity(data: FlowSessionAttributes): FlowSession {
    return new FlowSession(data);
  }
}
