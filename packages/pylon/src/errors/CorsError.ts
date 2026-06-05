import { ClientError } from "@lindorm/errors";

export class CorsError extends ClientError {
  public static readonly errorNamespace = "pylon";
}
