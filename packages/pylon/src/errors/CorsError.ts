import { ClientError } from "@lindorm/errors";

export class CorsError extends ClientError {
  static readonly namespace = "pylon";
}
