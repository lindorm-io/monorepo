import { type LindormErrorOptions, ServerError } from "@lindorm/errors";

export class IntrospectionEndpointFailed extends ServerError {
  static readonly namespace = "pylon";

  constructor(message?: string, options: LindormErrorOptions = {}) {
    super(message ?? "Introspection endpoint request failed", options);
  }
}
