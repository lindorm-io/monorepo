import { LindormError } from "@lindorm/errors";

export class JwtError extends LindormError {
  public static readonly errorNamespace = "aegis";
}
