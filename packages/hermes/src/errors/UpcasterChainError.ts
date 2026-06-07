import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export class UpcasterChainError extends LindormError {
  public static readonly namespace = "hermes";

  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message, options);
  }
}
