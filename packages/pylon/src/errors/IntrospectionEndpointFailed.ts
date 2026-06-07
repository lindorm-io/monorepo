import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class IntrospectionEndpointFailed extends ServerError {
  public static readonly namespace = "pylon";

  public constructor(message?: string, options: LindormErrorOptions = {}) {
    super(message ?? "Introspection endpoint request failed", options);
  }
}
