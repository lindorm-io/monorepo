import { LindormError } from "@lindorm-io/errors";
import { DomainErrorOptions } from "../types";

export class DomainError extends LindormError {
  public readonly permanent: boolean;

  public constructor(message: string, options: DomainErrorOptions = {}) {
    const { permanent = false, ...rest } = options;

    super(message, rest);

    this.permanent = permanent;
  }
}
