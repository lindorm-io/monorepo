import { ServerError } from "@lindorm/errors";

export class IntrospectionEndpointFailed extends ServerError {
  public constructor(message?: string) {
    super(message ?? "Introspection endpoint request failed");
  }
}
