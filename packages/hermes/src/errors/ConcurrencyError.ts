import { LindormError } from "@lindorm/errors";

export class ConcurrencyError extends LindormError {
  public static readonly namespace = "hermes";
}
