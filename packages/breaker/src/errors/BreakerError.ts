import { LindormError } from "@lindorm/errors";

export class BreakerError extends LindormError {
  public static readonly namespace = "breaker";
}
