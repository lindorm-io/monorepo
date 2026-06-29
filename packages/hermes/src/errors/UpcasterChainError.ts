import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export class UpcasterChainError extends LindormError {
  static readonly namespace = "hermes";

  constructor(message: string, options: LindormErrorOptions = {}) {
    super(message, options);
  }
}
