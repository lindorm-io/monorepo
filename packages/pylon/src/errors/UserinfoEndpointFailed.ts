import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class UserinfoEndpointFailed extends ServerError {
  public static readonly namespace = "pylon";

  public constructor(message?: string, options: LindormErrorOptions = {}) {
    super(message ?? "Userinfo endpoint request failed", options);
  }
}
