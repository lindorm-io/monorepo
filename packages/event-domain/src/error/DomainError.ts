import { LindormError } from "@lindorm-io/errors";
import { DomainErrorOptions } from "../types";

export class DomainError extends LindormError {
  public readonly permanent: boolean;

  public constructor(message: string, options?: DomainErrorOptions) {
    super(message, options);

    this.permanent = options.permanent || false;
  }
}
