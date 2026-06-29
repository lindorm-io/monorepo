import { LindormError } from "@lindorm/errors";

export class ConcurrencyError extends LindormError {
  static readonly namespace = "hermes";
}
