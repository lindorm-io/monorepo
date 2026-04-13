import { ServerError } from "@lindorm/errors";

export class UserinfoEndpointFailed extends ServerError {
  public constructor(message?: string) {
    super(message ?? "Userinfo endpoint request failed");
  }
}
