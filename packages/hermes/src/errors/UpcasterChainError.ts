import { LindormError } from "@lindorm/errors";

export class UpcasterChainError extends LindormError {
  public constructor(message: string) {
    super(message);
  }
}
