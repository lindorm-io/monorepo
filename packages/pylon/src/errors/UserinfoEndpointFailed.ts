import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class UserinfoEndpointFailed extends ServerError {
  static readonly namespace = "pylon";

  constructor(message?: string, options: LindormErrorOptions = {}) {
    super(message ?? "Userinfo endpoint request failed", options);
  }
}
