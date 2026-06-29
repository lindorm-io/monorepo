import { LindormError } from "@lindorm/errors";

export class BreakerError extends LindormError {
  static readonly namespace = "breaker";
}
