import { LindormError } from "@lindorm/errors";

export class JwtError extends LindormError {
  static readonly namespace = "aegis";
}
